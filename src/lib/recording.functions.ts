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
            title: z.string().describe("12 字以内、能概括这段对话主题的标题"),
            tags: z.array(z.string()).describe("3-5 个话题标签，每个 2-6 字，如「商业化」「排期」"),
            summary: z.string().describe("150 字以内会议摘要"),
            decisions: z
              .array(z.object({ text: z.string(), owner: z.string(), due: z.string() }))
              .describe("明确的决议/行动项；due 无法确定时填空字符串"),
            insights: z
              .array(z.object({ title: z.string(), text: z.string() }))
              .describe("2-4 张「顿悟」卡片：这场对话里最值得停下来想的洞察，title 是一句金句，text 是 60 字以内解释"),
            commitments: z
              .array(
                z.object({
                  direction: z.enum(["mine", "theirs"]),
                  text: z.string(),
                  counterpart: z.string(),
                  due: z.string(),
                }),
              )
              .describe(
                "对话里说出口的承诺。direction=mine 表示用户答应别人，theirs 表示别人答应用户；counterpart 是对方称呼；due 为 YYYY-MM-DD，无法确定时填空字符串",
              ),
            people: z
              .array(
                z.object({
                  name: z.string(),
                  relation: z.string(),
                  context: z.string(),
                  follow_up: z.string(),
                }),
              )
              .describe(
                "对话里出现的关键人物。relation 如「直属上级」「跨部门同事」；context 是 40 字以内的关系观察；follow_up 是建议的下一步，没有就填空字符串",
              ),
            research_intro: z
              .string()
              .describe("一段 80 字以内的开场，说明从这场对话里看到的关键张力，用第二人称对用户说"),
            research_topics: z
              .array(z.object({ title: z.string(), angle: z.string() }))
              .describe("3-4 个值得展开做深度研究的选题，title 为选题名，angle 为切入角度一句话"),
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
        prompt: `这是一段会议录音的转写全文（总时长约 ${rec.duration_sec} 秒）。请完成：1) 起标题与话题标签；2) 按语义将全文切分为带时间码的段落（单发言人即可）；3) 150 字以内摘要；4) 决议与行动项；5) 顿悟卡片；6) 深度研究开场与选题；7) 三级思维导图；8) 双向承诺（我答应别人的 / 别人答应我的）；9) 关键人物与关系观察。\n\n转写全文：\n${text}`,
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
          user_id: context.userId,
          title: d.text,
          source: "meeting",
          due_at: null as string | null,
        }));
      if (todos.length > 0) {
        await context.supabase.from("todos").insert(todos);
      }

      // 双向承诺台账
      const commitments = structured.commitments
        .filter((c) => c.text.trim())
        .map((c) => ({
          user_id: context.userId,
          direction: c.direction,
          text: c.text,
          counterpart: c.counterpart ?? "",
          due_at: /^\d{4}-\d{2}-\d{2}$/.test(c.due) ? new Date(`${c.due}T12:00:00Z`).toISOString() : null,
          recording_id: data.recordingId,
        }));
      if (commitments.length > 0) {
        await context.supabase.from("commitments").insert(commitments);
      }

      // 关键人物：已存在则累计提及次数，否则新建
      for (const p of structured.people.filter((p) => p.name.trim())) {
        const { data: existing } = await context.supabase
          .from("people")
          .select("id, mentions")
          .eq("user_id", context.userId)
          .eq("name", p.name)
          .maybeSingle();
        if (existing) {
          await context.supabase
            .from("people")
            .update({
              mentions: (existing.mentions ?? 1) + 1,
              context: p.context || undefined,
              follow_up: p.follow_up || null,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await context.supabase.from("people").insert({
            user_id: context.userId,
            name: p.name,
            relation: p.relation || "同事",
            context: p.context ?? "",
            follow_up: p.follow_up || null,
          });
        }
      }


      await context.supabase
        .from("recordings")
        .update({
          status: "done",
          ...(structured.title?.trim() ? { title: structured.title.trim() } : {}),
          tags: structured.tags.slice(0, 5),
          summary: structured.summary,
          decisions: structured.decisions,
          insights: structured.insights,
          research_intro: structured.research_intro,
          research_topics: structured.research_topics,
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

const ResearchInput = z.object({ recordingId: z.string(), topic: z.string().min(2) });

/** 深度研究：基于这场对话的某个选题，生成一份长篇研究报告（Markdown） */
export const generateDeepResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI 服务未配置");

    const { data: rec } = await context.supabase
      .from("recordings")
      .select("title, summary, decisions")
      .eq("id", data.recordingId)
      .single();
    if (!rec) throw new Error("录音不存在");

    const { data: segs } = await context.supabase
      .from("transcript_segments")
      .select("text")
      .eq("recording_id", data.recordingId)
      .order("seq")
      .limit(400);
    const transcript = (segs ?? []).map((s) => s.text).join("\n").slice(0, 24000);

    const lovable = astraProvider(key);
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      prompt: `你是一名资深行业研究员。请围绕选题「${data.topic}」写一份深度研究报告，素材来自用户的一场真实对话。\n\n要求：用 Markdown；包含「核心结论」「关键论证」「反面视角」「对你的建议」四个部分；结论要具体、可执行，不要空话；不要编造统计数字，无法确证的判断标注为推测。全文 900-1300 字。\n\n对话标题：${rec.title}\n对话摘要：${rec.summary ?? ""}\n对话内容节选：\n${transcript}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const report = await result.text;

    await context.supabase
      .from("recordings")
      .update({ research_report: report })
      .eq("id", data.recordingId);

    return { report };
  });

const TranslateInput = z.object({
  audioBase64: z.string().min(100),
  mimeType: z.string().default("audio/webm"),
  targetLang: z.string().default("中文"),
});

/** 实时翻译：一段完整音频 → 原文 + 译文（不落库，由前端决定是否保存） */
export const translateAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TranslateInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI 服务未配置");

    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const original = await transcribe(new Blob([bytes], { type: data.mimeType }), key);

    const lovable = astraProvider(key);
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({
        schema: z.object({
          detected_lang: z.string().describe("原文语言，如「英语」「中文」「日语」"),
          translated: z.string().describe("译文，只输出译文本身"),
        }),
      }),
      prompt: `把下面这段口语转写翻译成${data.targetLang}。保持口语自然，不要解释、不要加注。\n\n原文：\n${original}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const out = await result.output;
    return { original, translated: out.translated, detectedLang: out.detected_lang };
  });
