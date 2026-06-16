CREATE TABLE IF NOT EXISTS public.plan_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name TEXT,
  last_name TEXT,
  plan TEXT NOT NULL CHECK (plan ~ '^[a-z0-9_-]+$'),
  billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
  price_id TEXT,
  source TEXT NOT NULL DEFAULT 'register' CHECK (source ~ '^[a-z0-9_-]+$'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_intents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS plan_intents_email_created_idx
  ON public.plan_intents (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS plan_intents_user_created_idx
  ON public.plan_intents (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_plan_intents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_intents_updated_at ON public.plan_intents;
CREATE TRIGGER trg_plan_intents_updated_at
  BEFORE UPDATE ON public.plan_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_plan_intents_updated_at();

DROP POLICY IF EXISTS plan_intents_anon_insert ON public.plan_intents;
CREATE POLICY plan_intents_anon_insert
  ON public.plan_intents
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS plan_intents_authenticated_insert ON public.plan_intents;
CREATE POLICY plan_intents_authenticated_insert
  ON public.plan_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS plan_intents_authenticated_select_own ON public.plan_intents;
CREATE POLICY plan_intents_authenticated_select_own
  ON public.plan_intents
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS plan_intents_authenticated_update_own ON public.plan_intents;
CREATE POLICY plan_intents_authenticated_update_own
  ON public.plan_intents
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
  );

GRANT INSERT ON TABLE public.plan_intents TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.plan_intents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plan_intents TO service_role;
