import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, recordingIds } = (await request.json()) as {
          messages?: UIMessage[];
          recordingIds?: string[];
        };
        if (!Array.isArray(messages)) return new Response("Messages are required", { status: 400 });
        const focus = Array.isArray(recordingIds) ? recordingIds.filter(Boolean).slice(0, 5) : [];

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // 以调用者身份读数据（RLS 生效），召回个人上下文
        const auth = request.headers.get("Authorization") ?? "";
        let context = "（暂时没有任何个人记录）";
        if (auth.startsWith("Bearer ")) {
          const pubKey = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
          const sb = createClient(process.env["SUPABASE_URL"]!, pubKey, {
            auth: { persistSession: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                h.set("Authorization", auth);
                h.set("apikey", pubKey);
                return fetch(input, { ...init, headers: h });
              },
            },
          });
          const [events, todos, recordings, health, emotions] = await Promise.all([
            sb.from("events").select("occurred_at, title, summary, category").order("occurred_at", { ascending: false }).limit(30),
            sb.from("todos").select("title, due_at, done, source").order("created_at", { ascending: false }).limit(30),
            sb.from("recordings").select("occurred_at, title, summary, decisions").eq("status", "done").order("occurred_at", { ascending: false }).limit(10),
            sb.from("health_metrics").select("recorded_at, metric, value, unit").order("recorded_at", { ascending: false }).limit(40),
            sb.from("emotion_points").select("recorded_at, valence, label, note").order("recorded_at", { ascending: false }).limit(20),
          ]);
          const parts = [
            "## 事件时间线",
            ...(events.data ?? []).map((e) => `- [${e.occurred_at}] ${e.title}：${e.summary}`),
            "## 待办",
            ...(todos.data ?? []).map((t) => `- [${t.done ? "已完成" : "未完成"}] ${t.title}${t.due_at ? `（截止 ${t.due_at}）` : ""}`),
            "## 会议",
            ...(recordings.data ?? []).map((r) => `- [${r.occurred_at}] ${r.title}：${r.summary ?? ""}`),
            "## 健康数据",
            ...(health.data ?? []).map((h) => `- [${h.recorded_at}] ${h.metric}: ${h.value}${h.unit}`),
            "## 情绪记录",
            ...(emotions.data ?? []).map((e) => `- [${e.recorded_at}] ${e.label}（${e.valence}）${e.note ?? ""}`),
          ];

          // 用户 @ 指定了某几条录音：把这些录音的逐字稿全文作为重点上下文
          if (focus.length > 0) {
            const [focusRecs, segs] = await Promise.all([
              sb.from("recordings").select("id, title, occurred_at, summary, decisions").in("id", focus),
              sb
                .from("transcript_segments")
                .select("recording_id, seq, speaker_label, text")
                .in("recording_id", focus)
                .order("seq")
                .limit(600),
            ]);
            parts.push("## 用户本次特别指定（@）的录音全文，优先依据这些内容回答");
            for (const r of focusRecs.data ?? []) {
              parts.push(`### 《${r.title}》（${r.occurred_at}）`);
              if (r.summary) parts.push(`摘要：${r.summary}`);
              const lines = (segs.data ?? [])
                .filter((s) => s.recording_id === r.id)
                .map((s) => `${s.speaker_label}：${s.text}`);
              parts.push(lines.join("\n").slice(0, 16000));
            }
          }

          context = parts.join("\n");
        }

        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });

        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system: `你是「回响」，用户的私人助理。你只根据下面这份用户个人数据回答问题；回答中注明信息来自哪条记录（例如「周三的会议」「昨晚的睡眠数据」）。如果数据里没有答案，直接说不知道，不要编造。健康数据仅供参考，不做医疗结论。回答用中文，简洁、有温度。\n\n${context}`,
          messages: await convertToModelMessages(messages),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
