CREATE TABLE public.knowledge_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  source_name text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_items TO authenticated;
GRANT ALL ON public.knowledge_items TO service_role;

ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_select" ON public.knowledge_items FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR (user_id IS NULL));
CREATE POLICY "knowledge_insert" ON public.knowledge_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "knowledge_update" ON public.knowledge_items FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "knowledge_delete" ON public.knowledge_items FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_knowledge_items_updated_at BEFORE UPDATE ON public.knowledge_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX knowledge_items_user_idx ON public.knowledge_items (user_id, created_at DESC);

INSERT INTO public.knowledge_items (user_id, category, title, content, source, source_name, tags) VALUES
(NULL, 'profile', '职业与岗位', '在一家消费品公司做增长运营，主要负责投放与私域转化，直属上级是林菲。', 'manual', NULL, ARRAY['工作','岗位']),
(NULL, 'preference', '沟通偏好', '不喜欢临时拉会，重要事情希望先文字对齐再开会；下午两点到四点是专注时段，尽量不排会。', 'manual', NULL, ARRAY['偏好','协作']),
(NULL, 'work', '本季度目标', 'Q3 目标是把私域复购率从 18% 提到 25%，关键动作是新老客分层与内容周更。', 'manual', NULL, ARRAY['目标','OKR']),
(NULL, 'people', '重要关系', '林菲（直属上级，重结果轻过程）、陈一舟（渠道合作，回复慢需追）、小唐（实习生，需要明确交付标准）。', 'manual', NULL, ARRAY['人际']),
(NULL, 'health', '身体基线', '静息心率约 62，平时睡眠 6.5 小时，压力大时容易入睡困难、深睡减少。', 'manual', NULL, ARRAY['健康']);
