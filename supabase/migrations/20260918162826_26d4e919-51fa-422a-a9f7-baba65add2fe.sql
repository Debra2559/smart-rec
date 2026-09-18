ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pods',
  ADD COLUMN IF NOT EXISTS insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS research_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS research_intro text,
  ADD COLUMN IF NOT EXISTS research_report text;

UPDATE public.recordings SET tags = ARRAY['产品评审','排期','用户增长'], source = 'pods'
  WHERE user_id IS NULL AND tags = '{}';

CREATE TABLE IF NOT EXISTS public.translation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  mode text NOT NULL DEFAULT 'listen',
  source_lang text NOT NULL DEFAULT 'auto',
  target_lang text NOT NULL DEFAULT 'zh',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_sessions TO authenticated;
GRANT ALL ON public.translation_sessions TO service_role;
ALTER TABLE public.translation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own translation sessions" ON public.translation_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.translation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.translation_sessions(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  speaker text NOT NULL DEFAULT 'A',
  original text NOT NULL,
  translated text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_lines TO authenticated;
GRANT ALL ON public.translation_lines TO service_role;
ALTER TABLE public.translation_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own translation lines" ON public.translation_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.translation_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.translation_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));