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

export type CommitmentRow = {
  id: string;
  user_id: string | null;
  direction: string;
  text: string;
  counterpart: string;
  due_at: string | null;
  done: boolean;
  recording_id: string | null;
};
export type PersonRow = {
  id: string;
  user_id: string | null;
  name: string;
  relation: string;
  context: string;
  follow_up: string | null;
  mentions: number;
  last_seen_at: string;
};
export type GrowthReportRow = {
  id: string;
  period_start: string;
  content: string;
  highlights: string[];
  habits: string[];
  created_at: string;
};

export async function fetchGrowthData() {
  const [commitments, people, reports] = await Promise.all([
    supabase.from("commitments").select("*").order("due_at", { nullsFirst: false }),
    supabase.from("people").select("*").order("mentions", { ascending: false }),
    supabase.from("growth_reports").select("*").order("created_at", { ascending: false }).limit(1),
  ]);
  return {
    commitments: (commitments.data ?? []) as unknown as CommitmentRow[],
    people: (people.data ?? []) as unknown as PersonRow[],
    report: ((reports.data ?? [])[0] ?? null) as unknown as GrowthReportRow | null,
  };
}

export type TrendDay = {
  day: string;
  label: string;
  keptRate: number | null;
  mood: number | null;
  voiceShare: number | null;
  meetings: number;
};

/** 近 7 天：承诺兑现率、情绪水平、会议里我的发言占比 */
export async function fetchWeeklyTrend(): Promise<TrendDay[]> {
  const days: TrendDay[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const [commitments, emotions, recordings] = await Promise.all([
    supabase.from("commitments").select("id, created_at, due_at, done"),
    supabase
      .from("emotion_points")
      .select("recorded_at, valence")
      .gte("recorded_at", start.toISOString()),
    supabase
      .from("recordings")
      .select("id, occurred_at")
      .gte("occurred_at", start.toISOString()),
  ]);

  const recs = (recordings.data ?? []) as { id: string; occurred_at: string }[];
  let segs: { recording_id: string; speaker_label: string; text: string }[] = [];
  if (recs.length) {
    const { data } = await supabase
      .from("transcript_segments")
      .select("recording_id, speaker_label, text")
      .in(
        "recording_id",
        recs.map((r) => r.id),
      );
    segs = (data ?? []) as typeof segs;
  }

  const coms = (commitments.data ?? []) as {
    created_at: string;
    due_at: string | null;
    done: boolean;
  }[];
  const emos = (emotions.data ?? []) as { recorded_at: string; valence: number }[];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const end = new Date(d);
    end.setDate(d.getDate() + 1);
    const key = fmtDate(d);

    // 截至当天已存在的承诺的兑现率
    const pool = coms.filter((c) => new Date(c.created_at) < end);
    const keptRate = pool.length
      ? Math.round((pool.filter((c) => c.done).length / pool.length) * 100)
      : null;

    // 当天情绪（valence -2..2 映射到 0..100）
    const dayEmos = emos.filter((e) => {
      const t = new Date(e.recorded_at);
      return t >= d && t < end;
    });
    const mood = dayEmos.length
      ? Math.round(
          (dayEmos.reduce((a, e) => a + (e.valence + 2) / 4, 0) / dayEmos.length) * 100,
        )
      : null;

    // 当天会议里「说话人 1」（本人）的字数占比
    const dayRecIds = recs
      .filter((r) => {
        const t = new Date(r.occurred_at);
        return t >= d && t < end;
      })
      .map((r) => r.id);
    const daySegs = segs.filter((s) => dayRecIds.includes(s.recording_id));
    const total = daySegs.reduce((a, s) => a + s.text.length, 0);
    const own = daySegs
      .filter((s) => s.speaker_label.includes("1"))
      .reduce((a, s) => a + s.text.length, 0);
    const voiceShare = total ? Math.round((own / total) * 100) : null;

    days.push({
      day: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      keptRate,
      mood,
      voiceShare,
      meetings: dayRecIds.length,
    });
  }
  return days;
}

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
  const [{ data: rec }, { data: segs }, { data: coms }] = await Promise.all([
    supabase.from("recordings").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("transcript_segments")
      .select("*")
      .eq("recording_id", id)
      .order("seq"),
    supabase
      .from("commitments")
      .select("*")
      .eq("recording_id", id)
      .order("created_at"),
  ]);
  return {
    recording: (rec ?? null) as unknown as RecordingRow | null,
    segments: (segs ?? []) as SegmentRow[],
    commitments: (coms ?? []) as unknown as CommitmentRow[],
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

export type KnowledgeRow = {
  id: string;
  user_id: string | null;
  category: string;
  title: string;
  content: string;
  source: string;
  source_name: string | null;
  tags: string[];
  created_at: string;
};

export const KNOWLEDGE_CATEGORY_LABEL: Record<string, string> = {
  profile: "个人档案",
  preference: "偏好习惯",
  work: "工作目标",
  people: "人际关系",
  health: "身体状况",
  other: "其他",
};

export async function fetchKnowledge() {
  const { data } = await supabase
    .from("knowledge_items")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as KnowledgeRow[];
}
