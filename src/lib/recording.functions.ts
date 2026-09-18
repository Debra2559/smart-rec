import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProcessInput = z.object({ recordingId: z.string() });

/** 转写音频（非流式，一次性返回全文） */
async function transcribe(audio: Blob, key: string): Promise<string> {
  const form = new FormData();
  form.append("model", "google/gemini-3.5-transcribe");
  form.append("file", audio, "recording.webm");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`转写失败（${res.status}）`);
  const json = (await res.json()) as { text?: string };
  if (!json.text?.trim()) throw new Error("未识别到语音内容");
  return json.text;
}

function astraProvider(key: string) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

/** 深度录音：转写 → 分段逐字稿 → 摘要 + 决议 + 思维导图 */
export const processRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProcessInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI 服务未配置");

    const { data: rec } = await context.supabase
      .from("recordings")
      .select("id, audio_path, duration_sec")
      .eq("id", data.recordingId)
      .single();
    if (!rec?.audio_path) throw new Error("录音不存在");

    try {
      const { data: fileData, error: dlErr } = await context.supabase.storage
        .from("recordings")
        .download(rec.audio_path);
      if (dlErr || !fileData) throw new Error("无法读取音频");

      const text = await transcribe(fileData, key);
      const lovable = astraProvider(key);
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({
          schema: z.object({
            segments: z
              .array(
                z.object({
                  start_ms: z.number(),
                  end_ms: z.number(),
                  speaker_label: z.string(),
                  text: z.string(),
                }),
              )
              .describe("按语义切分的逐字稿段落，单发言人时全部用「发言人 1」"),
            summary: z.string().describe("150 字以内会议摘要"),
            decisions: z
              .array(z.object({ text: z.string(), owner: z.string(), due: z.string() }))
              .describe("明确的决议/行动项；due 无法确定时填空字符串"),
            mindmap: z.object({
              label: z.string(),
              children: z
                .array(
                  z.object({
                    label: z.string(),
                    children: z.array(z.object({ label: z.string() })).optional(),
                  }),
                )
                .optional(),
            }),
          }),
        }),
        prompt: `这是一段会议录音的转写全文（总时长约 ${rec.duration_sec} 秒）。请完成：1) 按语义将全文切分为带时间码的段落（单发言人即可）；2) 150 字以内摘要；3) 决议与行动项；4) 三级思维导图。\n\n转写全文：\n${text}`,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const structured = await result.output;

      // 逐字稿分段入库
      if (structured.segments.length > 0) {
        await context.supabase.from("transcript_segments").insert(
          structured.segments.map((s, i) => ({
            recording_id: data.recordingId,
            seq: i,
            start_ms: Math.round(s.start_ms),
            end_ms: Math.round(s.end_ms),
            speaker_label: s.speaker_label,
            text: s.text,
          })),
        );
      }

      // 决议同时进入待办（会议来源）
      const todos = structured.decisions
        .filter((d) => d.text.trim())
        .map((d) => ({
          title: d.text,
          source: "meeting",
          due_at: null as string | null,
        }));
      if (todos.length > 0) {
        await context.supabase.from("todos").insert(todos);
      }

      await context.supabase
        .from("recordings")
        .update({
          status: "done",
          summary: structured.summary,
          decisions: structured.decisions,
          mindmap: structured.mindmap,
        })
        .eq("id", data.recordingId);

      return { ok: true };
    } catch (err) {
      await context.supabase
        .from("recordings")
        .update({ status: "failed" })
        .eq("id", data.recordingId);
      throw err;
    }
  });

const PassiveInput = z.object({
  audioBase64: z.string().min(100),
  mimeType: z.string().default("audio/webm"),
});

/**
 * 陪伴模式处理：转写 → 结构化提取（事件/待办/情绪）→ 入库 → 丢弃一切音频与原文。
 * 本函数不写任何存储、不保存转写文本，严格兑现「只有摘要」的隐私契约。
 */
export const ingestPassiveAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PassiveInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI 服务未配置");

    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const text = await transcribe(new Blob([bytes], { type: data.mimeType }), key);

    const lovable = astraProvider(key);
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({
        schema: z.object({
          events: z
            .array(
              z.object({
                title: z.string(),
                summary: z.string(),
                category: z.enum(["work", "life", "social", "health"]),
                mood: z.string(),
              }),
            )
            .describe("值得记录的事件；摘要必须是改写，不得引用原文长句"),
          todos: z.array(z.object({ title: z.string() })).describe("提到的待办事项"),
          emotion: z
            .object({ valence: z.number().min(-2).max(2), label: z.string() })
            .nullable()
            .describe("整体情绪；无明显情绪时为 null"),
        }),
      }),
      prompt: `以下是陪伴设备刚刚听到的一段日常对话（转写仅在本次请求内存中存在）。请提取：1) 值得记录的事件（用你自己的话概括，绝不引用原文）；2) 待办事项；3) 整体情绪。\n\n对话内容：\n${text}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const structured = await result.output;

    const now = new Date().toISOString();
    if (structured.events.length > 0) {
      await context.supabase.from("events").insert(
        structured.events.map((e) => ({
          occurred_at: now,
          title: e.title,
          summary: e.summary,
          category: e.category,
          mood: e.mood || null,
        })),
      );
    }
    if (structured.todos.length > 0) {
      await context.supabase
        .from("todos")
        .insert(structured.todos.map((t) => ({ title: t.title, source: "passive" })));
    }
    if (structured.emotion) {
      await context.supabase.from("emotion_points").insert({
        recorded_at: now,
        valence: structured.emotion.valence,
        label: structured.emotion.label,
      });
    }
    // 转写文本 text 到此随请求结束被丢弃，不落库、不落盘。
    return { ok: true, events: structured.events.length, todos: structured.todos.length };
  });
