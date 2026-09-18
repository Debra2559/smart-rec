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
          {selected.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">只看这些录音：</span>
              {selected.map((s) => (
                <span
                  key={s.id}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                >
                  @{s.title}
                  <button onClick={() => setSelected((p) => p.filter((x) => x.id !== s.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {picker && (
            <div className="mb-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-2">
              {(recordings ?? []).length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">还没有录音可以指定。</p>
              )}
              {(recordings ?? []).map((r) => {
                const on = selected.some((s) => s.id === r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected((p) =>
                        on ? p.filter((x) => x.id !== r.id) : [...p, { id: r.id, title: r.title }].slice(-5),
                      );
                      setPicker(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      on ? "bg-primary/10 text-primary" : "hover:bg-accent/60"
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{r.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                      {new Date(r.occurred_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              placeholder={
                selected.length > 0
                  ? "针对指定录音提问…"
                  : "问问你的待办、会议、情绪或身体状态，或用 @ 指定某条录音…"
              }
            />
            <PromptInputFooter className="justify-between">
              <button
                type="button"
                onClick={() => setPicker((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  picker || selected.length > 0
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AtSign className="h-3.5 w-3.5" />
                指定录音
              </button>
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
