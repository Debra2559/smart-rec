import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, X, Mic } from "lucide-react";
import { fetchRecordings } from "@/lib/data";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "问答 · 回响" },
      { name: "description", content: "随时问你的助手：待办、会议、情绪和身体状态，它都记得。" },
      { property: "og:title", content: "问答 · 回响" },
      { property: "og:description", content: "随时问你的助手：待办、会议、情绪和身体状态，它都记得。" },
    ],
  }),
  component: AskPage,
});

const SUGGESTIONS = [
  "我这周还有哪些待办没完成？",
  "昨天产品评审会上定了什么？",
  "我最近的情绪和睡眠怎么样？",
];

function AskPage() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<{ id: string; title: string }[]>([]);
  const { data: recordings } = useQuery({ queryKey: ["recordings"], queryFn: fetchRecordings });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const selectedIds = selected.map((s) => s.id).join(",");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { recordingIds: selectedIds ? selectedIds.split(",") : [] },
      }),
    [token, selectedIds],
  );

  const { messages, sendMessage, status } = useChat({
    id: "ask",
    transport,
    onFinish: async ({ message }) => {
      if (!user) return;
      const text = message.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      if (text) await supabase.from("chat_messages").insert({ role: "assistant", content: text, user_id: user.id });
    },
  });

  // 载入历史
  useEffect(() => {
    if (!user || loadedRef.current) return;
    loadedRef.current = true;
    supabase
      .from("chat_messages")
      .select("role, content")
      .order("created_at")
      .limit(50)
      .then(({ data }) => {
        if (data?.length) {
          const history: UIMessage[] = data.map((m, i) => ({
            id: `h-${i}`,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text", text: m.content }],
          }));
          // useChat 无 setMessages 时用 initial messages 更合适；这里通过重挂载 key 实现
          setInitial(history);
        }
      });
  }, [user]);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);

  const isLoading = status === "submitted" || status === "streaming";

  async function handleSubmit(message: { text?: string }) {
    const text = (message.text ?? "").trim();
    if (!text || isLoading) return;
    if (user) await supabase.from("chat_messages").insert({ role: "user", content: text, user_id: user.id });
    await sendMessage({ text });
  }

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col px-4 md:h-screen md:px-8">
        <header className="flex items-center gap-3 pt-6 pb-4">
          <img src={logo} alt="回响" className="h-8 w-8" />
          <div>
            <h1 className="font-display text-xl font-bold leading-none">问问回响</h1>
            <p className="mt-1 text-xs text-muted-foreground">只基于你自己的记录回答</p>
          </div>
        </header>

        <Conversation className="flex-1">
          <ConversationContent className="gap-6 px-1">
            {(initial ?? []).concat(messages).length === 0 && (
              <div className="flex flex-col items-center gap-6 py-16">
                <img src={logo} alt="" className="h-14 w-14 opacity-80" />
                <p className="text-sm text-muted-foreground">问点什么吧，比如：</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSubmit({ text: s })}
                      className="rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground/80 transition-colors hover:border-primary/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(initial ?? []).map((m) => <ChatMessage key={m.id} message={m} />)}
            {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
            {status === "submitted" && (
              <Shimmer className="text-sm" duration={1.5}>正在翻找你的记录…</Shimmer>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="pb-4 pt-2">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea placeholder="问问你的待办、会议、情绪或身体状态…" />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={isLoading || !token} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </AppShell>
  );
}

function ChatMessage({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  if (message.role === "user") {
    return (
      <Message from="user">
        <MessageContent className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {text}
        </MessageContent>
      </Message>
    );
  }
  return (
    <Message from="assistant">
      <MessageContent className="px-0 text-sm leading-relaxed">
        <MessageResponse>{text}</MessageResponse>
      </MessageContent>
    </Message>
  );
}
