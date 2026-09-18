create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.day_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  day date not null,
  content text not null,
  mood_score smallint,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.day_summaries to authenticated;
grant all on public.day_summaries to service_role;
alter table public.day_summaries enable row level security;
create policy "day_summaries_select" on public.day_summaries for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy "day_summaries_insert" on public.day_summaries for insert to authenticated with check (user_id = auth.uid());
create policy "day_summaries_update" on public.day_summaries for update to authenticated using (user_id = auth.uid());
create policy "day_summaries_delete" on public.day_summaries for delete to authenticated using (user_id = auth.uid());

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  occurred_at timestamptz not null,
  title text not null,
  summary text not null,
  category text not null default 'life',
  mood text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events_select" on public.events for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy "events_insert" on public.events for insert to authenticated with check (user_id = auth.uid());
create policy "events_update" on public.events for update to authenticated using (user_id = auth.uid());
create policy "events_delete" on public.events for delete to authenticated using (user_id = auth.uid());

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  due_at timestamptz,
  remind_at timestamptz,
  done boolean not null default false,
  source text not null default 'passive',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.todos to authenticated;
grant all on public.todos to service_role;
alter table public.todos enable row level security;
create policy "todos_select" on public.todos for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy "todos_insert" on public.todos for insert to authenticated with check (user_id = auth.uid());
create policy "todos_update" on public.todos for update to authenticated using (user_id = auth.uid());
create policy "todos_delete" on public.todos for delete to authenticated using (user_id = auth.uid());

create table public.emotion_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  recorded_at timestamptz not null,
  valence smallint not null,
  label text not null,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.emotion_points to authenticated;
grant all on public.emotion_points to service_role;
alter table public.emotion_points enable row level security;
create policy "emotion_points_select" on public.emotion_points for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy "emotion_points_insert" on public.emotion_points for insert to authenticated with check (user_id = auth.uid());
create policy "emotion_points_delete" on public.emotion_points for delete to authenticated using (user_id = auth.uid());

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  audio_path text,
  duration_sec integer not null default 0,
  status text not null default 'done',
  occurred_at timestamptz not null default now(),
  summary text,
  decisions jsonb not null default '[]',
  mindmap jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recordings to authenticated;
grant all on public.recordings to service_role;
alter table public.recordings enable row level security;
create policy "recordings_select" on public.recordings for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy "recordings_insert" on public.recordings for insert to authenticated with check (user_id = auth.uid());
create policy "recordings_update" on public.recordings for update to authenticated using (user_id = auth.uid());
create policy "recordings_delete" on public.recordings for delete to authenticated using (user_id = auth.uid());

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  seq integer not null,
  start_ms integer not null,
  end_ms integer not null,
  speaker_label text not null default '说话人 1',
  text text not null
);
grant select, insert, update, delete on public.transcript_segments to authenticated;
grant all on public.transcript_segments to service_role;
alter table public.transcript_segments enable row level security;
create policy "segments_select" on public.transcript_segments for select to authenticated using (exists (select 1 from public.recordings r where r.id = recording_id and (r.user_id = auth.uid() or r.user_id is null)));
create policy "segments_insert" on public.transcript_segments for insert to authenticated with check (exists (select 1 from public.recordings r where r.id = recording_id and r.user_id = auth.uid()));
create policy "segments_delete" on public.transcript_segments for delete to authenticated using (exists (select 1 from public.recordings r where r.id = recording_id and r.user_id = auth.uid()));

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null,
  display_name text not null,
  unique (user_id, label)
);
grant select, insert, update, delete on public.speakers to authenticated;
grant all on public.speakers to service_role;
alter table public.speakers enable row level security;
create policy "speakers_all_own" on public.speakers for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  recorded_at timestamptz not null,
  metric text not null,
  value numeric not null,
  unit text not null
);
grant select, insert, update, delete on public.health_metrics to authenticated;
grant all on public.health_metrics to service_role;
alter table public.health_metrics enable row level security;
create policy "health_select" on public.health_metrics for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy "health_insert" on public.health_metrics for insert to authenticated with check (user_id = auth.uid());
create policy "health_delete" on public.health_metrics for delete to authenticated using (user_id = auth.uid());

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  content text not null,
  sources jsonb not null default '[]',
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "chat_select_own" on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy "chat_insert_own" on public.chat_messages for insert to authenticated with check (user_id = auth.uid());
create policy "chat_delete_own" on public.chat_messages for delete to authenticated using (user_id = auth.uid());

insert into public.events (user_id, occurred_at, title, summary, category, mood) values
(null, now() - interval '9 hours 20 minutes', '通勤路上听行业播客', '听到一期关于 AI 硬件创业的访谈，提到“陪伴型设备的护城河是长期个人模型”，你对此有共鸣，想到自己产品的差异化方向。', 'life', '平静'),
(null, now() - interval '7 hours 50 minutes', '晨会：Q4 目标拆解', '团队对齐了 Q4 的三条主线：留存、付费转化、硬件量产排期。你负责留存模块，需要在下周五前给出方案初稿。', 'work', '专注'),
(null, now() - interval '5 hours 10 minutes', '与客户成功团队过投诉案例', '讨论了三个升级投诉，根源都指向录音同步延迟。你提议把同步状态做成用户可见的进度，得到认可。', 'work', '略紧张'),
(null, now() - interval '3 hours 25 minutes', '客户评审会（深度录音）', '和北极星科技开了季度评审，对方对摘要准确率满意，但希望会议纪要支持思维导图导出。气氛后半段明显轻松。', 'work', '专注'),
(null, now() - interval '2 hours 5 minutes', '和妈妈通电话', '聊了十分钟家常，妈妈提醒降温加衣。你答应这周末回家吃饭。', 'social', '温暖'),
(null, now() - interval '55 minutes', '健身房力量训练', '做了 40 分钟上肢训练，状态不错。训练中想到留存方案可以借鉴“连续记录”机制。', 'health', '愉悦');

insert into public.todos (user_id, title, due_at, remind_at, done, source) values
(null, '下周五前提交留存方案初稿', now() + interval '7 days', now() + interval '6 days 9 hours', false, 'passive'),
(null, '整理客户评审的导出需求，发给产品组', now() + interval '1 day', now() + interval '20 hours', false, 'meeting'),
(null, '周末回家吃饭，提前买水果', now() + interval '2 days', now() + interval '1 day 12 hours', false, 'passive'),
(null, '跟进录音同步延迟的排查进展', now() + interval '2 days', null, false, 'passive'),
(null, '回复 David 关于 API 限额的邮件', now() - interval '2 hours', null, true, 'passive');

insert into public.emotion_points (user_id, recorded_at, valence, label, note) values
(null, now() - interval '10 hours', 0, '平静', '起床后状态平稳'),
(null, now() - interval '8 hours', 1, '专注', '晨会进入工作状态'),
(null, now() - interval '5 hours', -1, '略紧张', '讨论投诉案例，感到压力'),
(null, now() - interval '3 hours', 1, '专注', '客户评审进展顺利'),
(null, now() - interval '2 hours', 2, '温暖', '和家人通话'),
(null, now() - interval '1 hours', 1, '愉悦', '健身后放松'),
(null, now() - interval '15 minutes', 0, '平静', '晚间安静');

insert into public.day_summaries (user_id, day, content, mood_score) values
(null, current_date,
'今天是一条很典型的“高压—回升”曲线。

上午的节奏是被外部推着走的：晨会拆解 Q4 目标，你接下了留存模块这个硬骨头；随后处理投诉案例时情绪出现了今天唯一的一次下探——值得注意的是，压力来源并不是投诉本身，而是“同步延迟”这个老问题又一次以用户怒火的形式回来找你。你在会上提出的“把同步状态做成用户可见进度”其实是个很好的转身：把被动解释变成主动透明。

下午的客户评审是转折点。摘要准确率得到认可，说明过去一个季度的投入开始兑现；对方要的思维导图导出并不意外——信息的“结构化回看”正在成为这一类工具的及格线。你在后半段明显放松下来，这种放松也延续到了和妈妈的通话里。

两个值得记住的瞬间：一是通勤时听到的“陪伴型设备的护城河是长期个人模型”，二是在健身房想到的“连续记录机制”。它们其实指向同一件事——留存的本质不是提醒用户回来，而是让用户的历史数据变得不可替代。明天的方案初稿，不妨就从这句话写起。

身体层面：今天下午评审期间你的心率有一段明显爬升，但晚间 40 分钟力量训练完成度不错，今晚建议把入睡时间提前 30 分钟，把深睡补回来。',
42);

insert into public.recordings (user_id, title, duration_sec, status, occurred_at, summary, decisions, mindmap) values
(null, '北极星科技 · 季度产品评审', 2730, 'done', now() - interval '3 hours 25 minutes',
'双方回顾了上一季度摘要功能的使用情况：客户方 12 人团队周均生成 47 份会议纪要，摘要准确率满意度 4.5/5。主要诉求集中在三点：思维导图导出、待办与飞书日历的双向同步、说话人命名的跨会议沿用。价格上对方接受现有档位续约，但要求 Q4 内交付导图导出。会议后半段讨论了 2027 年扩容至 50 席的可能性。',
'[{"text":"Q4 内交付思维导图导出功能","owner":"我方产品组","due":"2026-12-15"},{"text":"提供飞书日历同步的排期评估","owner":"我方研发","due":"2026-09-25"},{"text":"输出 50 席扩容报价方案","owner":"客户成功","due":"2026-10-10"}]',
'{"label":"季度产品评审","children":[{"label":"使用情况","children":[{"label":"12 人团队"},{"label":"周均 47 份纪要"},{"label":"满意度 4.5/5"}]},{"label":"客户诉求","children":[{"label":"思维导图导出"},{"label":"飞书日历同步"},{"label":"说话人沿用"}]},{"label":"商务","children":[{"label":"现有档位续约"},{"label":"2027 扩容 50 席"}]}]}'),
(null, '留存方案脑暴（内部）', 1560, 'done', now() - interval '7 hours 55 minutes',
'围绕 Q4 留存目标的第一次脑暴。共识：工具属性的提醒类留存已见顶，机会在“个人数据资产”——让用户的历史摘要、会议和趋势变得不可替代。候选方向：连续记录 streak、月度个人报告、跨年回顾。风险：streak 断签惩罚感过强，需要柔性设计。',
'[{"text":"留存方案初稿下周五提交","owner":"我","due":"2026-09-25"},{"text":"先验证月度报告的原型","owner":"设计组","due":"2026-09-22"}]',
'{"label":"留存脑暴","children":[{"label":"判断","children":[{"label":"提醒类留存见顶"},{"label":"机会在数据资产"}]},{"label":"候选方向","children":[{"label":"连续记录"},{"label":"月度报告"},{"label":"跨年回顾"}]},{"label":"风险","children":[{"label":"断签惩罚感"}]}]}');

insert into public.transcript_segments (recording_id, seq, start_ms, end_ms, speaker_label, text)
select r.id, s.seq, s.start_ms, s.end_ms, s.speaker, s.text
from public.recordings r
cross join lateral (values
 (1, 0, 8200, '说话人 1', '我们先看一下上一季度的数据。你们团队这边一共是 12 个人在用，周均生成 47 份会议纪要，这个渗透率其实已经很不错了。'),
 (2, 8200, 21500, '说话人 2', '对，准确率这块我们是满意的，内部评的 4.5 分。主要想提的是导图——我们老板看纪要习惯先看结构图，现在还要手动整理。'),
 (3, 21500, 33400, '说话人 1', '思维导图导出这个需求我们记下来了，坦率说它已经在 Q4 的规划里，今天可以给一个承诺：12 月 15 号之前交付。'),
 (4, 33400, 45100, '说话人 2', '好。另外一个是日历，我们的待办现在落在你们这里，但团队日程在飞书，两头割裂，能不能做双向同步？'),
 (5, 45100, 58200, '说话人 1', '双向同步工程量不小，我先让研发出一版排期评估，下周三之前答复你。'),
 (6, 58200, 71000, '说话人 2', '行。价格这块我们按现有档位续约没问题。另外提前说一嘴，明年我们可能扩到 50 席，你们到时候给个报价。'),
 (7, 71000, 79000, '说话人 1', '没问题，50 席的报价方案我们 10 月 10 号前出。那今天先到这，剩下细节我们线上对齐。')
) as s(seq, start_ms, end_ms, speaker, text)
where r.title = '北极星科技 · 季度产品评审' and r.user_id is null;

insert into public.transcript_segments (recording_id, seq, start_ms, end_ms, speaker_label, text)
select r.id, s.seq, s.start_ms, s.end_ms, s.speaker, s.text
from public.recordings r
cross join lateral (values
 (1, 0, 6400, '说话人 1', '留存这个目标摆在这，提醒、推送这些手段我觉得已经到头了，今天想聊点不一样的。'),
 (2, 6400, 18900, '说话人 2', '我同意。用户不回来不是因为忘了，是因为走了也没损失。我们的摘要越攒越多，这本身就是资产。'),
 (3, 18900, 31200, '说话人 1', '对，方向就是让历史数据不可替代。具体形态我列了三个：连续记录、月度报告、跨年回顾。'),
 (4, 31200, 44800, '说话人 2', '连续记录要小心，断签的挫败感很强，可能反而劝退。要做就得做柔性的，比如允许补签、按周计算。'),
 (5, 44800, 52600, '说话人 1', '记下来。那这样，初稿我下周五交，设计这边先出月度报告的原型，下周二看个草图。')
) as s(seq, start_ms, end_ms, speaker, text)
where r.title = '留存方案脑暴（内部）' and r.user_id is null;

insert into public.health_metrics (user_id, recorded_at, metric, value, unit)
select null, now() - make_interval(mins => g * 15), 'heart_rate',
  62 + floor(18 * abs(sin(g / 3.0))) + case when g between 12 and 16 then 22 else 0 end, 'bpm'
from generate_series(1, 40) g;

insert into public.health_metrics (user_id, recorded_at, metric, value, unit) values
(null, now() - interval '10 hours', 'resting_hr', 58, 'bpm'),
(null, now() - interval '10 hours', 'hrv', 46, 'ms'),
(null, now() - interval '10 hours', 'sleep_total', 405, 'min'),
(null, now() - interval '10 hours', 'sleep_deep', 82, 'min'),
(null, now() - interval '30 minutes', 'steps', 8340, '步'),
(null, now() - interval '30 minutes', 'active_energy', 512, 'kcal'),
(null, now() - interval '10 hours', 'spo2', 98, '%'),
(null, now() - interval '1 hours', 'mindful_min', 10, 'min');