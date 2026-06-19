CREATE TABLE IF NOT EXISTS public.deleted_account (
  created_at TIMESTAMPTZ DEFAULT now(),
  email VARCHAR DEFAULT ''::varchar NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  CONSTRAINT deleted_account_pkey PRIMARY KEY (id)
);

ALTER TABLE public.deleted_account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable update for users based on email" ON public.deleted_account;
CREATE POLICY "Enable update for users based on email"
  ON public.deleted_account
  FOR INSERT
  TO authenticated
  WITH CHECK (
    encode(extensions.digest((SELECT auth.email()), 'sha256'), 'hex') = email::text
  );

CREATE OR REPLACE FUNCTION public.is_not_deleted(email_check VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_found INTEGER;
BEGIN
  SELECT count(*)
  INTO is_found
  FROM public.deleted_account
  WHERE email = email_check;

  RETURN is_found = 0;
END;
$$;

REVOKE ALL ON FUNCTION public.is_not_deleted(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_not_deleted(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.is_not_deleted(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_not_deleted(VARCHAR) TO service_role;

GRANT SELECT, INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, UPDATE
  ON TABLE public.deleted_account TO anon;
GRANT SELECT, INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, UPDATE
  ON TABLE public.deleted_account TO authenticated;
GRANT SELECT, INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, UPDATE
  ON TABLE public.deleted_account TO service_role;
