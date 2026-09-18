import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Handshake,
  Users,
  MessageSquareQuote,
  Sparkles,
  Check,
  Circle,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchGrowthData, fetchWeeklyTrend, type CommitmentRow } from "@/lib/data";
import { generateGrowthReport } from "@/lib/growth.functions";

export const Route = createFileRoute("/growth")({
  head: () => ({
    meta: [
      { title: "成长 · 回响" },
      { name: "description", content: "承诺台账、人际跟进、表达习惯与每周成长复盘。" },
      { property: "og:title", content: "成长 · 回响" },
      { property: "og:description", content: "承诺台账、人际跟进、表达习惯与每周成长复盘。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GrowthPage,
});

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return "刚刚";
  if (h < 24) return `${h} 小时前`;
  return `${Math.round(h / 24)} 天前`;
}

function dueLabel(iso: string | null) {
  if (!iso) return "无期限";
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `逾期 ${-days} 天`;
  if (days === 0) return "今天到期";
  if (days === 1) return "明天到期";
  return `${days} 天后`;
}

function GrowthPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["growth"], queryFn: fetchGrowthData });
  const runReport = useServerFn(generateGrowthReport);
  const [generating, setGenerating] = useState(false);
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});

  const commitments = data?.commitments ?? [];
  const people = data?.people ?? [];
  const report = data?.report ?? null;

  const isDone = (c: CommitmentRow) => localDone[c.id] ?? c.done;
  const mine = commitments.filter((c) => c.direction === "mine");
  const theirs = commitments.filter((c) => c.direction === "theirs");
  const kept = commitments.filter((c) => isDone(c)).length;
  const rate = commitments.length ? Math.round((kept / commitments.length) * 100) : 0;
  const overdue = commitments.filter(
    (c) => !isDone(c) && c.due_at && new Date(c.due_at).getTime() < Date.now(),
  ).length;

  async function toggle(c: CommitmentRow) {
    const next = !isDone(c);
    setLocalDone((s) => ({ ...s, [c.id]: next }));
    if (c.user_id && c.user_id === user?.id) {
      await supabase.from("commitments").update({ done: next }).eq("id", c.id);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      await runReport({});
      await queryClient.invalidateQueries({ queryKey: ["growth"] });
      toast.success("本周成长复盘已生成");
    } catch {
      toast.error("生成失败，稍后再试");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-16">
        <header className="mb-8">
          <h1 className="font-display text-[28px] font-semibold md:text-3xl">成长</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            你说出口的承诺、常打交道的人、说话的习惯，和这一周的变化。
          </p>
        </header>

        {/* 概览 */}
        <div className="mb-5 grid grid-cols-3 gap-4 md:gap-5">
          <Stat label="承诺兑现率" value={`${rate}%`} hint={`${kept} / ${commitments.length}`} />
          <Stat label="待我兑现" value={`${mine.filter((c) => !isDone(c)).length}`} hint="件" />
          <Stat label="已逾期" value={`${overdue}`} hint={overdue ? "需要今天处理" : "保持得不错"} />
        </div>

        {/* 周趋势 */}
        <section className="mb-5">
          <WeekTrend />
        </section>

        {/* 承诺台账 */}
        <section className="mb-5 grid gap-4 md:grid-cols-2 md:gap-5">
          <Panel icon={Handshake} title="我答应别人的">
            <CommitList list={mine} isDone={isDone} onToggle={toggle} />
          </Panel>
          <Panel icon={Handshake} title="别人答应我的">
            <CommitList list={theirs} isDone={isDone} onToggle={toggle} />
          </Panel>
        </section>

        {/* 人际跟进 */}
        <section className="mb-5">
          <Panel icon={Users} title="最近常打交道的人">
            <div className="grid gap-4 sm:grid-cols-2">
              {people.map((p) => (
                <div key={p.id} className="rounded-2xl bg-secondary/40 p-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground">{p.relation}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                      {p.mentions} 次 · {relTime(p.last_seen_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.context}</p>
                  {p.follow_up && (
                    <p className="mt-3 flex gap-2 text-xs leading-relaxed text-primary">
                      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {p.follow_up}
                    </p>
                  )}
                </div>
              ))}
              {people.length === 0 && <Empty text="还没有识别到经常出现的人。" />}
            </div>
          </Panel>
        </section>

        {/* 表达习惯 */}
        {report?.habits?.length ? (
          <section className="mb-5">
            <Panel icon={MessageSquareQuote} title="你的表达习惯">
              <ul className="space-y-3">
                {report.habits.map((h, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        ) : null}

        {/* 成长周报 */}
        <section>
          <Panel icon={Sparkles} title="本周成长复盘">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {report ? "重新生成" : "生成复盘"}
              </button>
              {report && (
                <span className="text-[11px] text-muted-foreground">
                  统计自 {report.period_start}
                </span>
              )}
            </div>

            {report?.highlights?.length ? (
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {report.highlights.map((h, i) => (
                  <div key={i} className="rounded-2xl bg-secondary/40 p-4 text-xs leading-relaxed text-foreground/85">
                    {h}
                  </div>
                ))}
              </div>
            ) : null}

            {report ? (
              <div className="space-y-4">
                {report.content.split("\n").filter((l) => l.trim()).map((line, i) =>
                  line.startsWith("##") ? (
                    <h3 key={i} className="pt-2 font-display text-base font-semibold">
                      {line.replace(/^#+\s*/, "")}
                    </h3>
                  ) : (
                    <p key={i} className="text-sm leading-[1.9] text-foreground/80">
                      {line}
                    </p>
                  ),
                )}
              </div>
            ) : (
              <Empty text="还没有复盘。点上面的按钮，用这一周的记录生成一份。" />
            )}
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums md:text-3xl">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 md:p-7">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function CommitList({
  list,
  isDone,
  onToggle,
}: {
  list: CommitmentRow[];
  isDone: (c: CommitmentRow) => boolean;
  onToggle: (c: CommitmentRow) => void;
}) {
  if (list.length === 0) return <Empty text="暂时没有这类承诺。" />;
  return (
    <ul className="space-y-4">
      {list.map((c) => {
        const done = isDone(c);
        const late = !done && c.due_at && new Date(c.due_at).getTime() < Date.now();
        return (
          <li key={c.id} className="flex gap-3">
            <button onClick={() => onToggle(c)} className="mt-0.5 shrink-0 text-primary">
              {done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4 opacity-40" />}
            </button>
            <div className="min-w-0">
              <p className={`text-sm leading-relaxed ${done ? "text-muted-foreground line-through" : ""}`}>
                {c.text}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{c.counterpart || "未指明对象"}</span>
                <span>·</span>
                <span className={late ? "text-destructive" : ""}>{dueLabel(c.due_at)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>;
}

const SERIES = [
  { key: "keptRate" as const, label: "承诺兑现率", color: "oklch(0.58 0.12 278)" },
  { key: "mood" as const, label: "情绪水平", color: "oklch(0.72 0.11 205)" },
  { key: "voiceShare" as const, label: "我的发言占比", color: "oklch(0.78 0.1 60)" },
];

function WeekTrend() {
  const { data } = useQuery({ queryKey: ["weekly-trend"], queryFn: fetchWeeklyTrend });
  const days = data ?? [];
  const W = 320;
  const H = 108;

  function points(key: (typeof SERIES)[number]["key"]) {
    return days
      .map((d, i) => ({ i, v: d[key] }))
      .filter((p): p is { i: number; v: number } => p.v !== null)
      .map((p) => ({
        x: (p.i / Math.max(days.length - 1, 1)) * W,
        y: H - (p.v / 100) * H,
      }));
  }

  function path(key: (typeof SERIES)[number]["key"]) {
    const pts = points(key);
    if (pts.length < 2) return "";
    return pts
      .map((p, n) => `${n === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }

  const hasData = days.some((d) => SERIES.some((s) => d[s.key] !== null));

  return (
    <Panel icon={TrendingUp} title="本周趋势">
      {hasData ? (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
          <svg
            viewBox={`0 -6 ${W} ${H + 12}`}
            preserveAspectRatio="none"
            className="mt-5 h-32 w-full"
          >
            {[0, 0.5, 1].map((g) => (
              <line
                key={g}
                x1="0"
                x2={W}
                y1={H - g * H}
                y2={H - g * H}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-border"
              />
            ))}
            {SERIES.flatMap((s) =>
              points(s.key).map((p, n) => (
                <circle
                  key={`${s.key}-${n}`}
                  cx={p.x}
                  cy={p.y}
                  r="2.6"
                  fill={s.color}
                  vectorEffect="non-scaling-stroke"
                />
              )),
            )}
            {SERIES.map((s) => (
              <path
                key={s.key}
                d={path(s.key)}
                fill="none"
                stroke={s.color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            {days.map((d) => (
              <span key={d.day}>{d.label}</span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            三条线放在一起看：兑现率掉下去的那几天，往往也是情绪走低、你在会上说得最多或最少的那几天。
          </p>
        </>
      ) : (
        <Empty text="再积累几天的记录，这里就会出现你的周趋势。" />
      )}
    </Panel>
  );
}
