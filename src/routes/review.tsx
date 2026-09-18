import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fmtTime } from "@/lib/data";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "回顾 · 回响" },
      { name: "description", content: "日历视图回顾每一天的事件与会议。" },
      { property: "og:title", content: "回顾 · 回响" },
      { property: "og:description", content: "日历视图回顾每一天的事件与会议。" },
    ],
  }),
  component: ReviewPage,
});

type DayItem = { kind: "event" | "meeting"; time: string; title: string };

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
      const [events, recordings] = await Promise.all([
        supabase.from("events").select("occurred_at, title").gte("occurred_at", from).lt("occurred_at", to),
        supabase.from("recordings").select("occurred_at, title").gte("occurred_at", from).lt("occurred_at", to),
      ]);
      return {
        events: (events.data ?? []) as { occurred_at: string; title: string }[],
        recordings: (recordings.data ?? []) as { occurred_at: string; title: string }[],
      };
    },
  });

  const byDay = useMemo(() => {
    const map: Record<string, DayItem[]> = {};
    for (const e of data?.events ?? []) {
      const key = e.occurred_at.slice(0, 10);
      (map[key] ??= []).push({ kind: "event", time: fmtTime(e.occurred_at), title: e.title });
    }
    for (const r of data?.recordings ?? []) {
      const key = r.occurred_at.slice(0, 10);
      (map[key] ??= []).push({ kind: "meeting", time: fmtTime(r.occurred_at), title: r.title });
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [data]);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstWeekday = (new Date(year, mon, 1).getDay() + 6) % 7; // 周一起
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(mon + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];
  const todayKey = new Date().toISOString().slice(0, 10);
  const selectedItems = selected ? (byDay[selected] ?? []) : [];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <header className="mb-6 flex items-end justify-between">
          <h1 className="font-display text-3xl font-bold">回顾</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(new Date(year, mon - 1, 1))}
              className="rounded-lg border border-border p-2 hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-24 text-center font-mono text-sm">
              {year} 年 {mon + 1} 月
            </span>
            <button
              onClick={() => setMonth(new Date(year, mon + 1, 1))}
              className="rounded-lg border border-border p-2 hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 grid grid-cols-7 text-center text-[10px] text-muted-foreground">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((key, i) => {
              if (!key) return <div key={`e-${i}`} />;
              const items = byDay[key] ?? [];
              const day = Number(key.slice(8));
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                    selected === key
                      ? "bg-primary text-primary-foreground"
                      : key === todayKey
                        ? "border border-primary/50 text-primary"
                        : "hover:bg-accent"
                  }`}
                >
                  <span className="font-mono text-xs">{day}</span>
                  {items.length > 0 && (
                    <span className="mt-1 flex gap-0.5">
                      {items.slice(0, 3).map((it, j) => (
                        <span
                          key={j}
                          className={`h-1 w-1 rounded-full ${it.kind === "meeting" ? "bg-chart-2" : selected === key ? "bg-primary-foreground" : "bg-primary"}`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium">
            {selected
              ? new Date(selected).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })
              : "点一天看看"}
          </h2>
          {selected && (
            <div className="space-y-3">
              {selectedItems.map((it, i) => (
                <div key={i} className="flex items-baseline gap-3 text-sm">
                  <span className="font-mono text-xs text-primary">{it.time}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      it.kind === "meeting" ? "bg-chart-2/20 text-chart-2" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {it.kind === "meeting" ? "会议" : "事件"}
                  </span>
                  <span className="text-foreground/90">{it.title}</span>
                </div>
              ))}
              {selectedItems.length === 0 && (
                <p className="text-sm text-muted-foreground">这一天没有记录。</p>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
