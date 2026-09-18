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

export const KNOWLEDGE_CATEGORIES = [
  "profile",
  "preference",
  "work",
  "people",
  "health",
  "other",
] as const;

/**
 * 外部导入：把一段任意文本（笔记、简历、周报、聊天记录导出等）
 * 拆成一条条结构化的「关于我」的知识条目。
 */
export const importKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; sourceName?: string }) => {
    const text = (input?.text ?? "").trim();
    if (text.length < 10) throw new Error("内容太短，至少 10 个字");
    return { text: text.slice(0, 30000), sourceName: (input?.sourceName ?? "").slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI 服务未配置");

    const lovable = astraProvider(key);
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({
        schema: z.object({
          items: z
            .array(
              z.object({
                category: z
                  .enum(KNOWLEDGE_CATEGORIES)
                  .describe("profile=基本档案；preference=偏好与习惯；work=工作目标与项目；people=人际关系；health=身体；other=其他"),
                title: z.string().describe("6-14 字的小标题"),
                content: z.string().describe("一到三句陈述句，第三人称改成「我」，保留具体数字与人名"),
                tags: z.array(z.string()).describe("1-3 个中文标签"),
              }),
            )
            .describe("3-15 条，不要重复，不要把无关的流程性内容也收进来"),
        }),
      }),
      system:
        "你在帮用户整理一个只关于「他本人」的个人知识库。从给到的文本中抽取长期有效、能帮助助手更懂他的事实：身份与工作、目标、偏好与工作习惯、重要的人、身体状况、经历。忽略一次性的琐事、寒暄和与他本人无关的内容。全部用中文。",
      prompt: `来源：${data.sourceName || "未命名"}\n\n文本：\n${data.text}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const parsed = await result.output;
    const items = (parsed?.items ?? []).slice(0, 20);
    if (items.length === 0) return { inserted: 0 };

    const { error } = await context.supabase.from("knowledge_items").insert(
      items.map((i) => ({
        user_id: context.userId,
        category: i.category,
        title: i.title,
        content: i.content,
        tags: i.tags ?? [],
        source: "import",
        source_name: data.sourceName || null,
      })),
    );
    if (error) throw new Error(error.message);
    return { inserted: items.length };
  });
