import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  Upload,
  Trash2,
  Loader2,
  FileText,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchKnowledge,
  KNOWLEDGE_CATEGORY_LABEL,
  type KnowledgeRow,
} from "@/lib/data";
import { importKnowledge } from "@/lib/knowledge.functions";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "知识库 · 回响" },
      {
        name: "description",
        content: "关于你的个人知识库：档案、偏好、目标、人际与身体，支持从外部文本导入。",
      },
      { property: "og:title", content: "知识库 · 回响" },
      {
        property: "og:description",
        content: "关于你的个人知识库：档案、偏好、目标、人际与身体，支持从外部文本导入。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgePage,
});

const CATEGORY_ORDER = ["profile", "preference", "work", "people", "health", "other"] as const;

const SOURCE_LABEL: Record<string, string> = {
  manual: "手动录入",
  import: "外部导入",
  recording: "录音提取",
};

function KnowledgePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["knowledge"], queryFn: fetchKnowledge });
  const runImport = useServerFn(importKnowledge);
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "", category: "profile" });
  const [importText, setImportText] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const items = data ?? [];
  const visible = items.filter((i) => {
    if (filter !== "all" && i.category !== filter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.content.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  async function saveDraft() {
    if (!user) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      toast.error("标题和内容都要填");
      return;
    }
    const { error } = await supabase.from("knowledge_items").insert({
      user_id: user.id,
      category: draft.category,
      title: draft.title.trim(),
      content: draft.content.trim(),
      source: "manual",
    });
    if (error) {
      toast.error("保存失败");
      return;
    }
    setDraft({ title: "", content: "", category: draft.category });
    setAdding(false);
    await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    toast.success("已记住");
  }

  async function remove(item: KnowledgeRow) {
    if (item.user_id !== user?.id) {
      toast.info("示例条目不能删除");
      return;
    }
    await supabase.from("knowledge_items").delete().eq("id", item.id);
    await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
  }

  async function doImport(text: string, name: string) {
    if (text.trim().length < 10) {
      toast.error("内容太短");
      return;
    }
    setImporting(true);
    try {
      const res = await runImport({ data: { text, sourceName: name } });
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      setImportText("");
      setImportName("");
      setShowImport(false);
      toast.success(`已从「${name || "导入内容"}」整理出 ${res.inserted} 条`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    await doImport(text, file.name);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 font-display text-[28px] font-semibold">
            <BookOpen className="h-6 w-6 text-primary" />
            知识库
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            关于你的一切长期信息都存在这里。问答、复盘和录音提取都会参考它，也可以把外部的笔记、简历、周报直接导进来。
          </p>
        </header>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => {
              setAdding((v) => !v);
              setShowImport(false);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> 添加一条
          </button>
          <button
            onClick={() => {
              setShowImport((v) => !v);
              setAdding(false);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Upload className="h-4 w-4 text-primary" /> 外部导入
          </button>
        </div>

        {adding && (
          <section className="mb-5 rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft((d) => ({ ...d, category: c }))}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    draft.category === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {KNOWLEDGE_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="小标题，比如「我的工作节奏」"
              className="mb-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <textarea
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              rows={3}
              placeholder="具体内容，写得越具体，助手越懂你"
              className="mb-3 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-primary/50"
            />
            <button
              onClick={saveDraft}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              保存
            </button>
          </section>
        )}

        {showImport && (
          <section className="mb-5 rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              粘贴任意文本，或上传 .txt / .md / .csv / .json 文件，会自动整理成一条条「关于我」的条目。
            </p>
            <input
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="来源名称，比如「2026 上半年总结」"
              className="mb-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder="把笔记、简历、周报、聊天记录导出贴进来…"
              className="mb-3 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-primary/50"
            />
            <div className="flex flex-wrap gap-2">
              <button
                disabled={importing}
                onClick={() => doImport(importText, importName)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? "整理中…" : "开始整理"}
              </button>
              <button
                disabled={importing}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                <FileText className="h-4 w-4 text-primary" /> 选择文件
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown,.csv,.json,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </section>
        )}

        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索知识库"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            全部 {items.length}
          </button>
          {CATEGORY_ORDER.map((c) => {
            const n = items.filter((i) => i.category === c).length;
            if (!n) return null;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  filter === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {KNOWLEDGE_CATEGORY_LABEL[c]} {n}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {visible.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              还没有内容，先添加一条或导入一份笔记
            </p>
          )}
          {visible.map((item) => (
            <article key={item.id} className="group rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.content}</p>
                </div>
                <button
                  onClick={() => remove(item)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-secondary px-2 py-0.5">
                  {KNOWLEDGE_CATEGORY_LABEL[item.category] ?? item.category}
                </span>
                {item.tags.map((t) => (
                  <span key={t} className="rounded-full bg-secondary px-2 py-0.5">
                    {t}
                  </span>
                ))}
                <span>
                  {SOURCE_LABEL[item.source] ?? item.source}
                  {item.source_name ? ` · ${item.source_name}` : ""}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
