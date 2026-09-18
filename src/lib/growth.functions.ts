import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function astraProvider(key: string) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

/**
 * 成长周报：用最近 7 天的事件、情绪、身体数据、会议摘要与承诺，
 * 生成一份「这一周你在变成什么样的人」的复盘，并提炼表达习惯。
 */
export const generateGrowthReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI 服务未配置");

    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [events, emotions, health, recordings, commitments, people, segments] = await Promise.all([
      context.supabase.from("events").select("occurred_at, title, summary, category, mood").gte("occurred_at", since).order("occurred_at"),
      context.supabase.from("emotion_points").select("recorded_at, valence, label").gte("recorded_at", since).order("recorded_at"),
      context.supabase.from("health_metrics").select("recorded_at, metric, value, unit").gte("recorded_at", since),
      context.supabase.from("recordings").select("id, title, summary, tags, duration_sec, occurred_at").gte("occurred_at", since).order("occurred_at"),
      context.supabase.from("commitments").select("direction, text, counterpart, due_at, done"),
      context.supabase.from("people").select("name, relation, context, follow_up, mentions"),
      context.supabase.from("transcript_segments").select("speaker_label, text").order("seq").limit(300),
    ]);

    const brief = JSON.stringify(
      {
        events: events.data ?? [],
        emotions: emotions.data ?? [],
        health: (health.data ?? []).slice(0, 200),
        meetings: recordings.data ?? [],
        commitments: commitments.data ?? [],
        people: people.data ?? [],
      },
      null,
      0,
    ).slice(0, 18000);
    const speech = (segments.data ?? [])
      .map((s) => `${s.speaker_label}：${s.text}`)
      .join("\n")
      .slice(0, 10000);

    const lovable = astraProvider(key);
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({
        schema: z.object({
          content: z
            .string()
            .describe(
              "Markdown 周报，包含四个二级标题：「这一周你在做什么」「你的能量花在哪里」「值得继续的」「下周一件事」。用第二人称、具体、不说空话，引用真实数字（情绪值、心率、睡眠、承诺完成数）。600-900 字。",
            ),
          highlights: z.array(z.string()).describe("3-4 条一句话洞察，每条 25 字以内，是事件与身体/情绪的关联发现"),
          habits: z.array(z.string()).describe("2-4 条表达与沟通习惯观察，基于逐字稿，如口头禅、提问方式、被打断后的反应；每条 30 字以内"),
        }),
      }),
      prompt: `你是这位职场用户的成长教练。下面是他最近 7 天由随身录音设备记录、结构化后的数据，以及最近几场对话的逐字稿节选。请写一份成长周报，并提炼他的表达习惯。\n\n要求：只用数据里真实存在的事实，不要编造；如果数据很少，就诚实地说观察样本不足，并给出下周应该多记录什么。\n\n结构化数据：\n${brief}\n\n逐字稿节选：\n${speech || "（本周暂无深度录音逐字稿）"}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const out = await result.output;

    const monday = new Date();
    monday.setDate(monday.getDate() - 6);

    const { data: saved } = await context.supabase
      .from("growth_reports")
      .insert({
        user_id: context.userId,
        period_start: monday.toISOString().slice(0, 10),
        content: out.content,
        highlights: out.highlights,
        habits: out.habits,
      })
      .select("id, period_start, content, highlights, habits, created_at")
      .single();

    return { report: saved };
  });
