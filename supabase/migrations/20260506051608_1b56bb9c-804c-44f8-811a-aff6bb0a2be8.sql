CREATE TABLE public.driver_certification_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_certification_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own certification tests"
ON public.driver_certification_tests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own certification tests"
ON public.driver_certification_tests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_driver_cert_user ON public.driver_certification_tests(user_id, created_at DESC);