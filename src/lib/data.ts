import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string;
  user_id: string | null;
  occurred_at: string;
  title: string;
  summary: string;
  category: string;
  mood: string | null;
};
export type TodoRow = {
  id: string;
  user_id: string | null;
  title: string;
  due_at: string | null;
  done: boolean;
  source: string;
};
export type EmotionRow = {
  id: string;
  recorded_at: string;
  valence: number;
  label: string;
  note: string | null;
};
export type HealthRow = {
  id: string;
  recorded_at: string;
  metric: string;
  value: number;
  unit: string;
};
export type DaySummaryRow = {
  id: string;
  day: string;
  content: string;
  mood_score: number | null;
};
export type InsightCard = { title: string; text: string };
export type ResearchTopic = { title: string; angle: string };
export type RecordingRow = {
  id: string;
  user_id: string | null;
  title: string;
  audio_path: string | null;
  duration_sec: number;
  status: string;
  occurred_at: string;
  summary: string | null;
  decisions: { text: string; owner: string; due: string }[];
  mindmap: MindmapNode | null;
  tags: string[];
  source: string;
  insights: InsightCard[];
  research_topics: ResearchTopic[];
  research_intro: string | null;
  research_report: string | null;
};
export type MindmapNode = { label: string; children?: MindmapNode[] };

export const SOURCE_LABEL: Record<string, string> = {
  pods: "耳机",
  speaker: "扬声器",
  call: "通话",
  phone: "手机",
};
export type SegmentRow = {
  id: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  speaker_label: string;
  text: string;
};

export async function fetchTodayData() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const [events, todos, emotions, health, summary] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .gte("occurred_at", sinceIso)
      .order("occurred_at"),
    supabase.from("todos").select("*").order("created_at"),
    supabase
      .from("emotion_points")
      .select("*")
      .gte("recorded_at", sinceIso)
      .order("recorded_at"),
    supabase
      .from("health_metrics")
      .select("*")
      .gte("recorded_at", sinceIso)
      .order("recorded_at"),
    supabase
      .from("day_summaries")
      .select("*")
      .eq("day", since.toISOString().slice(0, 10))
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  return {
    events: (events.data ?? []) as EventRow[],
    todos: (todos.data ?? []) as TodoRow[],
    emotions: (emotions.data ?? []) as EmotionRow[],
    health: (health.data ?? []) as HealthRow[],
    daySummary: ((summary.data ?? [])[0] ?? null) as DaySummaryRow | null,
  };
}

export async function fetchRecordings() {
  const { data } = await supabase
    .from("recordings")
    .select("*")
    .order("occurred_at", { ascending: false });
  return (data ?? []) as unknown as RecordingRow[];
}

export async function fetchRecording(id: string) {
  const [{ data: rec }, { data: segs }] = await Promise.all([
    supabase.from("recordings").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("transcript_segments")
      .select("*")
      .eq("recording_id", id)
      .order("seq"),
  ]);
  return {
    recording: (rec ?? null) as unknown as RecordingRow | null,
    segments: (segs ?? []) as SegmentRow[],
  };
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`;
}
export function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export function fmtDate(d: Date) {
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
}
