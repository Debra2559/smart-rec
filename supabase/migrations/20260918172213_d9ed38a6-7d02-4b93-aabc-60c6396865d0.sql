CREATE TABLE public.commitments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  direction text NOT NULL DEFAULT 'mine',
  text text NOT NULL,
  counterpart text NOT NULL DEFAULT '',
  due_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  recording_id uuid REFERENCES public.recordings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY commitments_select ON public.commitments FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY commitments_insert ON public.commitments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY commitments_update ON public.commitments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY commitments_delete ON public.commitments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.people (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  name text NOT NULL,
  relation text NOT NULL DEFAULT '同事',
  context text NOT NULL DEFAULT '',
  follow_up text,
  mentions integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY people_select ON public.people FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY people_insert ON public.people FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY people_update ON public.people FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY people_delete ON public.people FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.growth_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  period_start date NOT NULL,
  content text NOT NULL,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  habits jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_reports TO authenticated;
GRANT ALL ON public.growth_reports TO service_role;
ALTER TABLE public.growth_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY growth_select ON public.growth_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY growth_insert ON public.growth_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY growth_update ON public.growth_reports FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY growth_delete ON public.growth_reports FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO public.commitments (user_id, direction, text, counterpart, due_at, done) VALUES
  (NULL, 'mine', '把商业化方案的第二版发给林菲', '林菲', now() + interval '2 day', false),
  (NULL, 'mine', '周五下班前给到设计排期确认', '陈一舟', now() + interval '3 day', false),
  (NULL, 'mine', '给实习生做一次一对一反馈', '小唐', now() + interval '5 day', false),
  (NULL, 'theirs', '提供上季度渠道投放的真实数据', '林菲', now() + interval '1 day', false),
  (NULL, 'theirs', '确认法务对合同第 7 条的意见', '周律师', now() + interval '4 day', false),
  (NULL, 'mine', '整理客户评审会的决议并同步群里', '团队', now() - interval '1 day', true);

INSERT INTO public.people (user_id, name, relation, context, follow_up, mentions, last_seen_at) VALUES
  (NULL, '林菲', '直属上级', '本周三次对话都围绕商业化节奏，她关心的是现金流而不是功能', '她还欠你投放数据，明天可以追一次', 7, now() - interval '4 hour'),
  (NULL, '陈一舟', '跨部门同事', '设计资源紧张，沟通里出现过两次情绪化表达', '排期问题建议当面谈一次，不要走群聊', 4, now() - interval '1 day'),
  (NULL, '小唐', '带的实习生', '主动提问变多，但仍不敢做判断', '给一个能自己做决定的小任务', 3, now() - interval '2 day'),
  (NULL, '周律师', '外部合作', '合同条款还有一处未确认', '等对方回复，周四未回就电话', 1, now() - interval '3 day');

INSERT INTO public.growth_reports (user_id, period_start, content, highlights, habits) VALUES
  (NULL, (current_date - 6), E'## 这一周你在做什么\n\n七天里你有 11 场需要动脑的对话，其中 4 场和商业化节奏相关。你反复在同一个问题上打转：方案要不要先做小范围验证。这说明决策卡点不在信息，而在你还没拿到可以说服林菲的那组数字。\n\n## 你的能量花在哪里\n\n周二和周四是两个高强度日，静息心率分别比基线高 6 和 8 次/分，当晚深睡都少于 1 小时。这两天你都参加了超过 90 分钟、且自己发言不足三成的会议——被动消耗比主动输出更耗你。\n\n## 值得继续的\n\n你在冲突场景里开始先问再判断，陈一舟那场对话你用了三个澄清式提问才给结论，这是这周最明显的进步。\n\n## 下周一件事\n\n只挑一件：把商业化方案的判断依据压缩成一页数字，带着它去找林菲，而不是带着方案。', '["高强度日与睡眠质量强相关，连续两次","主动发言占比低的会议消耗最大","冲突场景里已经能先澄清再判断"]'::jsonb, '["提问前的铺垫偏长，平均 3 句才进入正题","习惯用「其实」开头软化观点，一周出现 24 次","被打断后很少接回自己的原话题"]'::jsonb);