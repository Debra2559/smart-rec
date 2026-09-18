import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Search,
  Loader2,
  GitBranch,
  ListChecks,
  ScrollText,
  Lightbulb,
  FlaskConical,
  LayoutGrid,
  Handshake,
  Users,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  fetchRecording,
  fmtDuration,
  fmtMs,
  SOURCE_LABEL,
  type MindmapNode,
  type CommitmentRow,
  type RecordingRow,
  type SegmentRow,
} from "@/lib/data";
import { generateDeepResearch } from "@/lib/recording.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/meetings_/$id")({
  head: () => ({
    meta: [
      { title: "会议详情 · 回响" },
      { name: "description", content: "逐字稿、思维导图、决议与待办。" },
    ],
  }),
  component: MeetingDetailPage,
});

const SPEAKER_COLORS = ["text-primary", "text-chart-2", "text-chart-3", "text-chart-4"];
const SPEAKER_BG = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4"];

type TabKey = "overview" | "transcript" | "mindmap" | "decisions" | "insights" | "research";

function MeetingDetailPage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<TabKey>("overview");
  const [q, setQ] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["recording", id],
    queryFn: () => fetchRecording(id),
  });
  const rec = data?.recording;
  const segments = useMemo(() => {
    const segs = data?.segments ?? [];
    if (!q.trim()) return segs;
    return segs.filter((s) => s.text.includes(q.trim()));
  }, [data, q]);

  // 转写中轮询
  useEffect(() => {
    if (rec?.status !== "transcribing" && rec?.status !== "recording") return;
    const t = setInterval(() => refetch(), 5000);
    return () => clearInterval(t);
  }, [rec?.status, refetch]);

  useEffect(() => {
    if (!rec?.audio_path) return;
    supabase.storage
      .from("recordings")
      .createSignedUrl(rec.audio_path, 3600)
      .then(({ data: d }) => d?.signedUrl && setAudioUrl(d.signedUrl));
  }, [rec?.audio_path]);

  if (!rec) {
    return (
      <AppShell>
        <div className="flex justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const speakers = [...new Set((data?.segments ?? []).map((s) => s.speaker_label))];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        <Link to="/meetings" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> 返回会议列表
        </Link>
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold">{rec.title}</h1>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {new Date(rec.occurred_at).toLocaleString("zh-CN")} · {fmtDuration(rec.duration_sec)} ·{" "}
            {SOURCE_LABEL[rec.source] ?? rec.source} ·{" "}
            {rec.status === "done" ? "已完成" : rec.status === "transcribing" ? "转写中…" : rec.status === "failed" ? "转写失败" : "录制中"}
          </p>
          {(rec.tags ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rec.tags.map((t) => (
                <span key={t} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {audioUrl && (
            <audio controls src={audioUrl} className="mt-4 w-full" />
          )}
        </header>

        {rec.status === "done" && rec.summary && (
          <section className="mb-6 rounded-xl border border-primary/25 bg-card p-5">
            <h2 className="text-sm font-medium text-primary">摘要</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{rec.summary}</p>
            {speakers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {speakers.map((s, i) => (
                  <span key={s} className={`rounded-full bg-secondary px-2.5 py-1 text-[10px] ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {rec.status === "transcribing" && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            正在转写并提炼结构，通常 1 分钟内完成，页面会自动刷新。
          </div>
        )}

        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 [scrollbar-width:none]">
          {([
            ["overview", "概览", LayoutGrid],
            ["transcript", "逐字稿", ScrollText],
            ["mindmap", "思维导图", GitBranch],
            ["decisions", "决议与待办", ListChecks],
            ["insights", "顿悟", Lightbulb],
            ["research", "深度研究", FlaskConical],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex shrink-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs transition-colors ${
                tab === key ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <Overview
            rec={rec}
            segments={data?.segments ?? []}
            commitments={data?.commitments ?? []}
            speakers={speakers}
            onJump={setTab}
          />
        )}

        {tab === "transcript" && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="全文搜索…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-4">
              {segments.map((s) => {
                const idx = speakers.indexOf(s.speaker_label);
                return (
                  <div key={s.id} className="flex gap-4">
                    <div className="w-12 shrink-0 pt-0.5 text-right text-[10px] leading-5 tabular-nums text-muted-foreground">
                      {fmtMs(s.start_ms)}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-[10px] font-medium ${SPEAKER_COLORS[Math.max(idx, 0) % SPEAKER_COLORS.length]}`}>
                        {s.speaker_label}
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">{s.text}</p>
                    </div>
                  </div>
                );
              })}
              {segments.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {rec.status === "done" ? "没有匹配的段落。" : "逐字稿将在转写完成后出现。"}
                </p>
              )}
            </div>
          </section>
        )}

        {tab === "mindmap" && (
          <section className="rounded-xl border border-border bg-card p-6">
            {rec.mindmap ? <Mindmap node={rec.mindmap} depth={0} /> : (
              <p className="py-8 text-center text-sm text-muted-foreground">思维导图将在转写完成后生成。</p>
            )}
          </section>
        )}

        {tab === "decisions" && (
          <section className="rounded-xl border border-border bg-card p-5">
            {(rec.decisions ?? []).length > 0 ? (
              <ul className="divide-y divide-border">
                {rec.decisions.map((d, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-3 text-sm">
                    <span className="text-xs tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1">{d.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {d.owner}{d.due ? ` · ${d.due}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">决议与待办将在转写完成后生成。</p>
            )}
          </section>
        )}

        {tab === "insights" && (
          <section className="space-y-3">
            {(rec.insights ?? []).length > 0 ? (
              rec.insights.map((c, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex items-start gap-3">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-display text-base font-medium leading-snug">{c.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{c.text}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground">
                顿悟卡片将在转写完成后生成。
              </p>
            )}
          </section>
        )}

        {tab === "research" && <ResearchPanel rec={rec} onDone={() => refetch()} />}
      </div>
    </AppShell>
  );
}

function ResearchPanel({
  rec,
  onDone,
}: {
  rec: { id: string; research_intro: string | null; research_topics: { title: string; angle: string }[]; research_report: string | null };
  onDone: () => void;
}) {
  const run = useServerFn(generateDeepResearch);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(rec.research_report);

  async function start(topic: string) {
    setBusy(topic);
    setError(null);
    try {
      const res = await run({ data: { recordingId: rec.id, topic } });
      setReport(res.report);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-primary">深度研究</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">
          {rec.research_intro ?? "这场对话完成转写后，会在这里给出值得展开研究的选题。"}
        </p>
        <div className="mt-4 space-y-2">
          {(rec.research_topics ?? []).map((t) => (
            <div
              key={t.title}
              className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.angle}</div>
              </div>
              <button
                onClick={() => start(t.title)}
                disabled={busy !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy === t.title ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                生成报告
              </button>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        {busy && (
          <p className="mt-3 text-xs text-muted-foreground">正在检索与推演，约需 30 秒…</p>
        )}
      </div>

      {report && (
        <article className="rounded-xl border border-border bg-card p-6">
          <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
            {report.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              if (t.startsWith("### ")) return <h4 key={i} className="pt-2 font-display text-base font-medium">{t.slice(4)}</h4>;
              if (t.startsWith("## ")) return <h3 key={i} className="pt-3 font-display text-lg font-semibold">{t.slice(3)}</h3>;
              if (t.startsWith("# ")) return <h2 key={i} className="font-display text-xl font-semibold">{t.slice(2)}</h2>;
              if (t.startsWith("- ") || t.startsWith("* "))
                return <p key={i} className="pl-4">· {t.slice(2).replace(/\*\*/g, "")}</p>;
              return <p key={i}>{t.replace(/\*\*/g, "")}</p>;
            })}
          </div>
        </article>
      )}
    </section>
  );
}

function Mindmap({ node, depth }: { node: MindmapNode; depth: number }) {
  return (
    <div className={depth > 0 ? "ml-5 border-l border-border pl-4" : ""}>
      <div
        className={`my-1.5 inline-block rounded-lg px-3 py-1.5 text-sm ${
          depth === 0
            ? "bg-primary font-medium text-primary-foreground"
            : depth === 1
              ? "bg-secondary font-medium"
              : "bg-secondary/50 text-foreground/85"
        }`}
      >
        {node.label}
      </div>
      {node.children?.map((c, i) => <Mindmap key={i} node={c} depth={depth + 1} />)}
    </div>
  );
}

function Overview({
  rec,
  segments,
  commitments,
  speakers,
  onJump,
}: {
  rec: RecordingRow;
  segments: SegmentRow[];
  commitments: CommitmentRow[];
  speakers: string[];
  onJump: (t: TabKey) => void;
}) {
  const stats = useMemo(() => {
    const chars = segments.reduce((a, s) => a + s.text.length, 0);
    const bySpeaker = speakers.map((label, i) => {
      const own = segments.filter((s) => s.speaker_label === label);
      return {
        label,
        i,
        chars: own.reduce((a, s) => a + s.text.length, 0),
        turns: own.length,
      };
    });
    const total = chars || 1;
    const durMs = Math.max(
      rec.duration_sec * 1000,
      segments.length ? segments[segments.length - 1]!.end_ms : 0,
      1,
    );
    const buckets = 24;
    const density = Array.from({ length: buckets }, () => 0);
    for (const s of segments) {
      const b = Math.min(buckets - 1, Math.floor((s.start_ms / durMs) * buckets));
      density[b] = (density[b] ?? 0) + s.text.length;
    }
    const peak = Math.max(...density, 1);
    return {
      chars,
      bySpeaker: bySpeaker.sort((a, b) => b.chars - a.chars),
      total,
      density,
      peak,
      durMs,
    };
  }, [segments, speakers, rec.duration_sec]);

  const topics = (rec.mindmap?.children ?? []).map((c) => c.label);
  const decisions = rec.decisions ?? [];
  const insights = rec.insights ?? [];

  if (rec.status !== "done") {
    return (
      <p className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
        结构化概览会在转写完成后出现。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: Clock, label: "时长", value: fmtDuration(rec.duration_sec) },
          { icon: Users, label: "发言人", value: `${speakers.length} 人` },
          { icon: ListChecks, label: "决议待办", value: `${decisions.length} 条` },
          { icon: Handshake, label: "承诺", value: `${commitments.length} 条` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon className="h-4 w-4 text-primary" />
            <div className="mt-3 text-lg tabular-nums">{s.value}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {stats.bySpeaker.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">发言占比</h2>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-secondary">
            {stats.bySpeaker.map((s) => (
              <div
                key={s.label}
                className={SPEAKER_BG[s.i % SPEAKER_BG.length]}
                style={{ width: `${(s.chars / stats.total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2.5">
            {stats.bySpeaker.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-xs">
                <span className={`h-2 w-2 shrink-0 rounded-full ${SPEAKER_BG[s.i % SPEAKER_BG.length]}`} />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">{s.turns} 次发言</span>
                <span className="w-10 text-right tabular-nums">
                  {Math.round((s.chars / stats.total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {segments.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">对话节奏</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">越高的位置表示那段时间讨论越密集。</p>
          <div className="mt-4 flex h-20 items-end gap-1">
            {stats.density.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary/25"
                style={{ height: `${Math.max(4, (v / stats.peak) * 100)}%` }}
                title={`${fmtMs((stats.durMs / stats.density.length) * i)} 起`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>00:00</span>
            <span>{fmtMs(stats.durMs)}</span>
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">议题脉络</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map((t) => (
              <span key={t} className="rounded-full bg-secondary px-3 py-1.5 text-xs">
                {t}
              </span>
            ))}
          </div>
          <button
            onClick={() => onJump("mindmap")}
            className="mt-4 inline-flex items-center gap-1 text-xs text-primary"
          >
            展开思维导图 <ArrowRight className="h-3 w-3" />
          </button>
        </section>
      )}

      {commitments.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">这场里说出口的承诺</h2>
          <ul className="mt-3 space-y-3">
            {commitments.map((c) => (
              <li key={c.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                    c.direction === "mine" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {c.direction === "mine" ? "我答应" : "对方答应"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-relaxed">{c.text}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {c.counterpart || "未指明对象"}
                    {c.due_at ? ` · ${new Date(c.due_at).toLocaleDateString("zh-CN")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">最值得记住的一句</h2>
          <h3 className="mt-3 font-display text-base font-medium leading-snug">{insights[0]!.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{insights[0]!.text}</p>
          {insights.length > 1 && (
            <button
              onClick={() => onJump("insights")}
              className="mt-4 inline-flex items-center gap-1 text-xs text-primary"
            >
              还有 {insights.length - 1} 条顿悟 <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </section>
      )}

      {decisions.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">决议与待办</h2>
          <ul className="mt-3 space-y-3">
            {decisions.slice(0, 3).map((d, i) => (
              <li key={i} className="flex items-baseline gap-3 text-sm">
                <span className="text-xs tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">{d.text}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{d.owner}</span>
              </li>
            ))}
          </ul>
          {decisions.length > 3 && (
            <button
              onClick={() => onJump("decisions")}
              className="mt-4 inline-flex items-center gap-1 text-xs text-primary"
            >
              查看全部 {decisions.length} 条 <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </section>
      )}
    </div>
  );
}
