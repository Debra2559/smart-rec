import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Handshake,
  Users,
  MessageSquareQuote,
  ArrowRight,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fmtTime, type CommitmentRow, type PersonRow, type GrowthReportRow } from "@/lib/data";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "回顾 · 回响" },
      { name: "description", content: "日历视图回顾每一天的事件、会议、承诺与人际往来。" },
      { property: "og:title", content: "回顾 · 回响" },
      { property: "og:description", content: "日历视图回顾每一天的事件、会议、承诺与人际往来。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

type ItemKind = "event" | "meeting" | "commitment" | "person";
type DayItem = { kind: ItemKind; time: string; title: string; note?: string };

const KIND_LABEL: Record<ItemKind, string> = {
  event: "事件",
  meeting: "记录",
  commitment: "承诺",
  person: "人物",
};

const DOT_CLASS: Record<ItemKind, string> = {
  event: "bg-primary/70",
  meeting: "bg-chart-2",
  commitment: "bg-chart-4",
  person: "bg-chart-3",
};

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 该日期所在的周一 ~ 周日 */
function weekRange(key: string) {
  const d = new Date(`${key}T00:00:00`);
  const offset = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function ReviewPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["review", month.toISOString()],
    queryFn: async () => {
      const from = month.toISOString();
      const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
      const [events, recordings, commitments, people, reports] = await Promise.all([
        supabase.from("events").select("occurred_at, title").gte("occurred_at", from).lt("occurred_at", to),
        supabase.from("recordings").select("occurred_at, title").gte("occurred_at", from).lt("occurred_at", to),
        supabase.from("commitments").select("*"),
        supabase.from("people").select("*"),
        supabase.from("growth_reports").select("*").order("created_at", { ascending: false }),
      ]);
      return {
        events: (events.data ?? []) as { occurred_at: string; title: string }[],
        recordings: (recordings.data ?? []) as { occurred_at: string; title: string }[],
        commitments: (commitments.data ?? []) as unknown as CommitmentRow[],
        people: (people.data ?? []) as unknown as PersonRow[],
        reports: (reports.data ?? []) as unknown as GrowthReportRow[],
      };
    },
  });

  const commitments = data?.commitments ?? [];
  const people = data?.people ?? [];

  const byDay = useMemo(() => {
    const map: Record<string, DayItem[]> = {};
    for (const e of data?.events ?? []) {
      (map[dayKey(e.occurred_at)] ??= []).push({
        kind: "event",
        time: fmtTime(e.occurred_at),
        title: e.title,
      });
    }
    for (const r of data?.recordings ?? []) {
      (map[dayKey(r.occurred_at)] ??= []).push({
        kind: "meeting",
        time: fmtTime(r.occurred_at),
        title: r.title,
      });
    }
    for (const c of commitments) {
      if (!c.due_at) continue;
      (map[dayKey(c.due_at)] ??= []).push({
        kind: "commitment",
        time: fmtTime(c.due_at),
        title: c.text,
        note: `${c.direction === "mine" ? "我答应" : "对方答应"}${c.counterpart ? ` · ${c.counterpart}` : ""}${c.done ? " · 已兑现" : ""}`,
      });
    }
    for (const p of people) {
      (map[dayKey(p.last_seen_at)] ??= []).push({
        kind: "person",
        time: fmtTime(p.last_seen_at),
        title: p.name,
        note: p.relation,
      });
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [data, commitments, people]);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstWeekday = (new Date(year, mon, 1).getDay() + 6) % 7; // 周一起
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      `${year}-${String(mon + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
  const todayKey = dayKey(new Date().toISOString());
  const selectedItems = selected ? (byDay[selected] ?? []) : [];

  // 选中日期所在一周的成长明细
  const week = useMemo(() => {
    if (!selected) return null;
    const { start, end } = weekRange(selected);
    const inRange = (iso: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= start.getTime() && t < end.getTime();
    };
    const due = commitments.filter((c) => inRange(c.due_at));
    const kept = due.filter((c) => c.done).length;
    const met = people.filter((p) => inRange(p.last_seen_at));
    const report =
      (data?.reports ?? []).find((r) => {
        const t = new Date(`${r.period_start}T00:00:00`).getTime();
        return t >= start.getTime() && t < end.getTime();
      }) ?? null;
    return {
      label: `${start.getMonth() + 1}/${start.getDate()} – ${new Date(end.getTime() - 86_400_000).getMonth() + 1}/${new Date(end.getTime() - 86_400_000).getDate()}`,
      due,
      kept,
      rate: due.length ? Math.round((kept / due.length) * 100) : null,
      met,
      report,
    };
  }, [selected, commitments, people, data]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-semibold md:text-3xl">回顾</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              事件、记录、承诺到期和人际往来都标在日历上，点一天看这一周的成长明细。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setMonth(new Date(year, mon - 1, 1))}
              className="rounded-xl border border-border p-2 hover:bg-accent"
              aria-label="上个月"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-24 text-center text-sm tabular-nums">
              {year} 年 {mon + 1} 月
            </span>
            <button
              onClick={() => setMonth(new Date(year, mon + 1, 1))}
              className="rounded-xl border border-border p-2 hover:bg-accent"
              aria-label="下个月"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="glass rounded-[1.25rem] p-5">
          <div className="mb-2 grid grid-cols-7 text-center text-[10px] text-muted-foreground">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((key, i) => {
              if (!key) return <div key={`e-${i}`} />;
              const items = byDay[key] ?? [];
              const kinds = Array.from(new Set(items.map((it) => it.kind)));
              const day = Number(key.slice(8));
              const isSel = selected === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                    isSel
                      ? "bg-primary text-primary-foreground"
                      : key === todayKey
                        ? "border border-primary/40 text-primary"
                        : "hover:bg-accent"
                  }`}
                >
                  <span className="text-xs tabular-nums">{day}</span>
                  {kinds.length > 0 && (
                    <span className="mt-1 flex gap-0.5">
                      {kinds.slice(0, 4).map((k) => (
                        <span
                          key={k}
                          className={`h-1 w-1 rounded-full ${isSel ? "bg-primary-foreground" : DOT_CLASS[k]}`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
            {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[k]}`} />
                {KIND_LABEL[k]}
              </span>
            ))}
          </div>
        </div>

        <section className="glass mt-5 rounded-[1.25rem] p-6">
          <h2 className="mb-4 text-sm font-medium">
            {selected
              ? new Date(`${selected}T00:00:00`).toLocaleDateString("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })
              : "点一天看看"}
          </h2>
          {selected ? (
            <div className="space-y-4">
              {selectedItems.map((it, i) => (
                <div key={i} className="flex items-baseline gap-3 text-sm">
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{it.time}</span>
                  <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {KIND_LABEL[it.kind]}
                  </span>
                  <span className="min-w-0">
                    <span className="leading-relaxed">{it.title}</span>
                    {it.note && (
                      <span className="ml-2 text-[11px] text-muted-foreground">{it.note}</span>
                    )}
                  </span>
                </div>
              ))}
              {selectedItems.length === 0 && (
                <p className="text-sm text-muted-foreground">这一天没有记录。</p>
              )}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              选一天，下面会展开这一周的承诺、人物和表达习惯。
            </p>
          )}
        </section>

        {week && (
          <section className="glass mt-5 rounded-[1.25rem] p-6">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium">本周成长明细</h2>
              <span className="text-[11px] tabular-nums text-muted-foreground">{week.label}</span>
            </div>

            <div className="space-y-6">
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Handshake className="h-3.5 w-3.5" />
                  承诺 · 到期 {week.due.length} 件
                  {week.rate !== null && <span className="tabular-nums">兑现率 {week.rate}%</span>}
                </p>
                {week.due.length ? (
                  <ul className="space-y-3">
                    {week.due.map((c) => (
                      <li key={c.id} className="flex items-baseline gap-2 text-sm">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                            c.done ? "bg-primary/10 text-primary" : "bg-secondary/60 text-muted-foreground"
                          }`}
                        >
                          {c.done ? "已兑现" : c.direction === "mine" ? "待我做" : "等对方"}
                        </span>
                        <span className="min-w-0 leading-relaxed">
                          {c.text}
                          {c.counterpart && (
                            <span className="ml-2 text-[11px] text-muted-foreground">{c.counterpart}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">这一周没有承诺到期。</p>
                )}
              </div>

              <div>
                <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  打过交道的人 · {week.met.length}
                </p>
                {week.met.length ? (
                  <div className="flex flex-wrap gap-2">
                    {week.met.map((p) => (
                      <span
                        key={p.id}
                        className="rounded-full bg-secondary/50 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {p.name}
                        <span className="ml-1.5 text-[10px]">{p.relation}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">这一周没有识别到常出现的人。</p>
                )}
              </div>

              <div>
                <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                  表达习惯
                </p>
                {week.report?.habits?.length ? (
                  <ul className="space-y-2">
                    {week.report.habits.map((h, i) => (
                      <li key={i} className="text-sm leading-relaxed text-foreground/90">
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    这一周还没有成长复盘，去「成长」页生成后这里就会出现。
                  </p>
                )}
              </div>

              <Link
                to="/growth"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                去成长页看全部
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
