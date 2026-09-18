import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Circle, Radio, Heart, Footprints, Moon, Flame } from "lucide-react";
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

  async function toggleTodo(id: string, own: boolean, done: boolean) {
    const next = !done;
    setLocalDone((s) => ({ ...s, [id]: next }));
    if (own) {
      await supabase.from("todos").update({ done: next }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["today"] });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {/* 头部 */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{fmtDate(new Date())}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {events.length} 个事件 · {pending.length} 项待办 ·{" "}
              {emotions.length > 0 ? (emotions[emotions.length - 1]?.label ?? "—") : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Radio className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs">陪伴模式运行中</span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">不保存音频与原文</span>
          </div>
        </header>

        {/* 健康指标 */}
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: Heart, label: "静息心率", value: latest("resting_hr"), unit: "bpm" },
            { icon: Footprints, label: "步数", value: latest("steps"), unit: "步" },
            { icon: Moon, label: "睡眠", value: latest("sleep_total") ? `${Math.floor(Number(latest("sleep_total")) / 60)}h${Number(latest("sleep_total")) % 60}m` : null, unit: "" },
            { icon: Flame, label: "活动能量", value: latest("active_energy"), unit: "kcal" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <s.icon className="h-3.5 w-3.5 text-primary" />
                {s.label}
              </div>
              <div className="mt-2 font-mono text-2xl font-medium">
                {s.value ?? "—"}
                <span className="ml-1 text-xs text-muted-foreground">{s.unit}</span>
              </div>
            </div>
          ))}
        </section>

        {/* 心率 × 事件 叠加 */}
        {hrSeries.length > 0 && (
          <section className="mb-6 rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">心率走势</h2>
              <span className="text-xs text-muted-foreground">与今日事件时间线对齐</span>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hrSeries}>
                  <defs>
                    <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--color-muted-foreground)" }}
                  />
                  <Area type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={1.5} fill="url(#hr)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* 左：待办 + 情绪 */}
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-medium">
                待办 <span className="text-muted-foreground">· 从对话中自动捕捉</span>
              </h2>
              <ul className="space-y-2.5">
                {todos.map((t) => {
                  const done = localDone[t.id] ?? t.done;
                  return (
                    <li key={t.id} className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTodo(t.id, t.user_id !== null, done)}
                        className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
                      >
                        {done ? (
                          <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : (
                          <Circle className="h-4.5 w-4.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm leading-snug ${done ? "text-muted-foreground line-through" : ""}`}>
                          {t.title}
                        </p>
                        {t.due_at && (
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {t.source === "meeting" ? "会议" : t.source === "manual" ? "手动" : "捕捉"} ·{" "}
                            {new Date(t.due_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} 截止
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
                {todos.length === 0 && <p className="text-sm text-muted-foreground">今天还没有捕捉到待办。</p>}
              </ul>
            </section>

            {emotionSeries.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-medium">情绪曲线</h2>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={emotionSeries}>
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                      <YAxis hide domain={[-2, 2]} />
                      <Tooltip
                        contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                        formatter={((v: number, _n: string, item: { payload?: { label?: string } }) => [item?.payload?.label ?? v, "情绪"]) as never}
                      />
                      <Line type="monotone" dataKey="v" stroke="var(--color-chart-2)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-chart-2)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {emotions.find((e) => e.valence < 0)?.note
                    ? `低点：${emotions.find((e) => e.valence < 0)?.note}`
                    : "今天情绪整体平稳。"}
                </p>
              </section>
            )}
          </div>

          {/* 右：事件时间线 */}
          <section className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
            <h2 className="mb-4 text-sm font-medium">
              事件时间线 <span className="text-muted-foreground">· 只有摘要，没有原文</span>
            </h2>
            <div className="timeline-rail space-y-5 pl-7">
              {events.map((e) => (
                <article key={e.id} className="relative">
                  <span className="absolute -left-7 top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                  <div className="flex items-center gap-2">
                    <time className="font-mono text-xs text-primary">{fmtTime(e.occurred_at)}</time>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                      {CATEGORY_LABEL[e.category] ?? e.category}
                    </span>
                    {e.mood && <span className="text-[10px] text-muted-foreground">{e.mood}</span>}
                  </div>
                  <h3 className="mt-1 text-sm font-medium">{e.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.summary}</p>
                </article>
              ))}
              {events.length === 0 && (
                <p className="text-sm text-muted-foreground">陪伴模式正在倾听，事件会陆续出现在这里。</p>
              )}
            </div>
          </section>
        </div>

        {/* 晚间复盘 */}
        {data?.daySummary && (
          <section className="mt-6 rounded-xl border border-primary/25 bg-card p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">今日复盘</h2>
              <span className="font-mono text-xs text-muted-foreground">
                心情指数 {data.daySummary.mood_score ?? "—"}
              </span>
            </div>
            <div className="space-y-4 font-display text-[15px] leading-8 text-foreground/90">
              {data.daySummary.content.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
