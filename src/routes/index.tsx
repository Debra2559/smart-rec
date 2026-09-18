import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Check,
  Circle,
  Radio,
  Heart,
  Footprints,
  Moon,
  Flame,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { fetchTodayData, fmtTime, fmtDate } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "今天 · 回响" },
      { name: "description", content: "今天的待办、情绪曲线、事件时间线与身体状态，一屏看完。" },
      { property: "og:title", content: "今天 · 回响" },
      { property: "og:description", content: "今天的待办、情绪曲线、事件时间线与身体状态，一屏看完。" },
    ],
  }),
  component: TodayPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  work: "工作",
  life: "生活",
  social: "社交",
  health: "健康",
};

const CHART_TOOLTIP = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
};

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "凌晨好";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function TodayPage() {
  const { data } = useQuery({ queryKey: ["today"], queryFn: fetchTodayData });
  const queryClient = useQueryClient();
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});

  const todos = data?.todos ?? [];
  const events = data?.events ?? [];
  const emotions = data?.emotions ?? [];
  const health = data?.health ?? [];
  const pending = todos.filter((t) => !(localDone[t.id] ?? t.done));

  const hrSeries = health
    .filter((h) => h.metric === "heart_rate")
    .map((h) => ({ t: fmtTime(h.recorded_at), v: Number(h.value) }));
  const latest = (m: string): number | null => {
    const rows = health.filter((h) => h.metric === m);
    const last = rows[rows.length - 1];
    return last ? Number(last.value) : null;
  };
  const emotionSeries = emotions.map((e) => ({
    t: fmtTime(e.recorded_at),
    v: e.valence,
    label: e.label,
  }));
  const sleep = latest("sleep_total");

  async function toggleTodo(id: string, own: boolean, done: boolean) {
    const next = !done;
    setLocalDone((s) => ({ ...s, [id]: next }));
    if (own) {
      await supabase.from("todos").update({ done: next }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["today"] });
    }
  }

  const metrics = [
    { icon: Heart, label: "静息心率", value: latest("resting_hr"), unit: "bpm" },
    { icon: Footprints, label: "步数", value: latest("steps"), unit: "步" },
    {
      icon: Moon,
      label: "睡眠",
      value: sleep ? `${Math.floor(Number(sleep) / 60)}h${Number(sleep) % 60}m` : null,
      unit: "",
    },
    { icon: Flame, label: "活动能量", value: latest("active_energy"), unit: "kcal" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-10 md:py-16">
        {/* 头部 */}
        <header className="mb-9 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground">
              {fmtDate(new Date())}
            </p>
            <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight md:text-3xl">
              {greeting()}，今天有 {pending.length} 件事待办
            </h1>
          </div>
          <Link
            to="/review"
            className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
          >
            月度回顾
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        {/* 便当格 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {/* 状态条 */}
          <div className="col-span-2 flex items-center gap-2.5 rounded-2xl bg-card px-5 py-3.5 md:col-span-4">
            <Radio className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs font-semibold text-accent-foreground">陪伴模式运行中</span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="ml-auto text-[10px] text-accent-foreground/70">
              不保存音频与原文
            </span>
          </div>

          {/* 待办 —— 主块 */}
          <section className="col-span-2 row-span-2 rounded-2xl border border-border bg-card p-6 md:p-7">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-base font-bold tracking-tight">待办</h2>
              <span className="text-[10px] text-muted-foreground">从对话中自动捕捉</span>
            </div>
            <ul className="space-y-3">
              {todos.map((t) => {
                const done = localDone[t.id] ?? t.done;
                return (
                  <li key={t.id} className="flex items-start gap-3">
                    <button
                      onClick={() => toggleTodo(t.id, t.user_id !== null, done)}
                      className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      {done ? (
                        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <Circle className="h-[18px] w-[18px]" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          done ? "text-muted-foreground line-through" : "font-medium"
                        }`}
                      >
                        {t.title}
                      </p>
                      {t.due_at && (
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {t.source === "meeting" ? "会议" : t.source === "manual" ? "手动" : "捕捉"} ·{" "}
                          {new Date(t.due_at).toLocaleDateString("zh-CN", {
                            month: "numeric",
                            day: "numeric",
                          })}{" "}
                          截止
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
              {todos.length === 0 && (
                <p className="text-sm text-muted-foreground">今天还没有捕捉到待办。</p>
              )}
            </ul>
          </section>

          {/* 健康四小格 */}
          {metrics.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <s.icon className="h-3.5 w-3.5 text-primary" />
                {s.label}
              </div>
              <div className="mt-2 font-display text-2xl font-bold tracking-tight">
                {s.value ?? "—"}
                <span className="ml-1 font-sans text-[11px] font-medium text-muted-foreground">
                  {s.unit}
                </span>
              </div>
            </div>
          ))}

          {/* 心率 */}
          {hrSeries.length > 0 && (
            <section className="col-span-2 rounded-2xl border border-border bg-card p-6 md:p-7">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-sm font-bold tracking-tight">心率走势</h2>
                <span className="text-[10px] text-muted-foreground">与事件时间线对齐</span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hrSeries}>
                    <defs>
                      <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="t"
                      tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                    <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: "var(--color-muted-foreground)" }} />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="url(#hr)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* 情绪 */}
          {emotionSeries.length > 0 && (
            <section className="col-span-2 rounded-2xl border border-border bg-card p-6 md:p-7">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-sm font-bold tracking-tight">情绪曲线</h2>
                <span className="text-[10px] text-muted-foreground">
                  {emotions[emotions.length - 1]?.label ?? "—"}
                </span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={emotionSeries}>
                    <XAxis
                      dataKey="t"
                      tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide domain={[-2, 2]} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP}
                      formatter={
                        ((v: number, _n: string, item: { payload?: { label?: string } }) => [
                          item?.payload?.label ?? v,
                          "情绪",
                        ]) as never
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {emotions.find((e) => e.valence < 0)?.note
                  ? `低点：${emotions.find((e) => e.valence < 0)?.note}`
                  : "今天情绪整体平稳。"}
              </p>
            </section>
          )}

          {/* 事件时间线 */}
          <section className="col-span-2 rounded-2xl border border-border bg-card p-6 md:p-7 md:col-span-4">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-base font-bold tracking-tight">事件时间线</h2>
              <span className="text-[10px] text-muted-foreground">只有摘要，没有原文</span>
            </div>
            <div className="timeline-rail space-y-5 pl-7 md:columns-2 md:gap-8 md:[&>article]:break-inside-avoid">
              {events.map((e) => (
                <article key={e.id} className="relative">
                  <span className="absolute -left-7 top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-card" />
                  <div className="flex items-center gap-2">
                    <time className="font-mono text-[11px] font-medium text-primary">
                      {fmtTime(e.occurred_at)}
                    </time>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                      {CATEGORY_LABEL[e.category] ?? e.category}
                    </span>
                    {e.mood && (
                      <span className="text-[10px] text-muted-foreground">{e.mood}</span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">{e.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.summary}</p>
                </article>
              ))}
              {events.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  陪伴模式正在倾听，事件会陆续出现在这里。
                </p>
              )}
            </div>
          </section>

          {/* 晚间复盘 */}
          {data?.daySummary && (
            <section className="col-span-2 rounded-2xl border border-border bg-card p-6 md:p-10 md:col-span-4 md:p-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
                  <Sparkles className="h-4 w-4 text-primary" />
                  今日复盘
                </h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  心情指数 {data.daySummary.mood_score ?? "—"}
                </span>
              </div>
              <div className="mx-auto max-w-2xl space-y-4 text-[15px] leading-8 text-foreground/85">
                {data.daySummary.content.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
