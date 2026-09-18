import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mic, ChevronRight, Loader2, AlertCircle, Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { fetchRecordings, fmtDuration, fmtTime } from "@/lib/data";
import { RecordDialog } from "@/components/RecordDialog";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "会议 · 回响" },
      { name: "description", content: "深度录音：逐字稿、思维导图、决议与待办。" },
      { property: "og:title", content: "会议 · 回响" },
      { property: "og:description", content: "深度录音：逐字稿、思维导图、决议与待办。" },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const { data } = useQuery({ queryKey: ["recordings"], queryFn: fetchRecordings });
  const [recording, setRecording] = useState(false);

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

        <div className="space-y-3">
          {(data ?? []).map((r) => (
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
          {(data ?? []).length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              还没有深度录音。点右上角开始第一段。
            </p>
          )}
        </div>
      </div>
      {recording && <RecordDialog onClose={() => setRecording(false)} />}
    </AppShell>
  );
}
