import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mic, ChevronRight, Loader2, AlertCircle, Plus, Search, X, Languages } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { fetchRecordings, fmtDuration, fmtTime, SOURCE_LABEL } from "@/lib/data";
import { RecordDialog } from "@/components/RecordDialog";

export const Route = createFileRoute("/meetings")({
  validateSearch: (search: Record<string, unknown>): { rec?: string } =>
    typeof search["rec"] === "string" ? { rec: search["rec"] } : {},
  head: () => ({
    meta: [
      { title: "记录 · 回响" },
      { name: "description", content: "深度录音：逐字稿、思维导图、决议与待办。" },
      { property: "og:title", content: "记录 · 回响" },
      { property: "og:description", content: "深度录音：逐字稿、思维导图、决议与待办。" },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const { data } = useQuery({ queryKey: ["recordings"], queryFn: fetchRecordings });
  const { rec } = Route.useSearch();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(rec === "1");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (rec === "1") {
      setRecording(true);
      navigate({ to: "/meetings", search: {}, replace: true });
    }
  }, [rec, navigate]);

  const all = data ?? [];
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((r) => (r.tags ?? []).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [all]);
  const allSources = useMemo(
    () => [...new Set(all.map((r) => r.source).filter(Boolean))],
    [all],
  );

  const list = useMemo(() => {
    const kw = q.trim();
    return all.filter((r) => {
      if (tag && !(r.tags ?? []).includes(tag)) return false;
      if (source && r.source !== source) return false;
      if (kw && !`${r.title} ${r.summary ?? ""} ${(r.tags ?? []).join(" ")}`.includes(kw)) return false;
      return true;
    });
  }, [all, q, tag, source]);

  const filtering = Boolean(tag || source || q.trim());

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">会议</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              深度录音 · 完整保存音频与逐字稿，仅你可见
            </p>
          </div>
          <button
            onClick={() => setRecording(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            开始深度录音
          </button>
        </header>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题、摘要或标签…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {filtering && (
            <button
              onClick={() => {
                setQ("");
                setTag(null);
                setSource(null);
              }}
              className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> 清除
            </button>
          )}
        </div>

        {(allTags.length > 0 || allSources.length > 1) && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {allSources.map((s) => (
              <Chip key={s} active={source === s} onClick={() => setSource(source === s ? null : s)}>
                {SOURCE_LABEL[s] ?? s}
              </Chip>
            ))}
            {allSources.length > 0 && allTags.length > 0 && (
              <span className="mx-1 self-center text-border">|</span>
            )}
            {allTags.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                #{t}
              </Chip>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {list.map((r) => (
            <Link
              key={r.id}
              to="/meetings/$id"
              params={{ id: r.id }}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                {r.status === "transcribing" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : r.status === "failed" ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Mic className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium">{r.title}</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {r.status === "done" && r.summary ? r.summary : r.status === "transcribing" ? "正在转写…" : r.status === "failed" ? "转写失败" : "录制中"}
                </p>
                {((r.tags ?? []).length > 0 || r.source) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {r.source && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {SOURCE_LABEL[r.source] ?? r.source}
                      </span>
                    )}
                    {(r.tags ?? []).slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs text-foreground/80">{fmtDuration(r.duration_sec)}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {new Date(r.occurred_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} {fmtTime(r.occurred_at)}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          {list.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {filtering ? "没有符合条件的录音。" : "还没有深度录音。点右上角开始第一段。"}
            </p>
          )}
        </div>
      </div>
      {recording && <RecordDialog onClose={() => setRecording(false)} />}
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
