CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE public.cron_task_type AS ENUM ('function', 'http');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.apps (
  app_id TEXT PRIMARY KEY CHECK (app_id ~ '^[A-Za-z0-9_-]+([.][A-Za-z0-9_-]+)+$'),
  name TEXT NOT NULL,
  owner_org TEXT,
  ios_store_url TEXT,
  android_store_url TEXT,
  expose_metadata BOOLEAN NOT NULL DEFAULT false,
  transfer_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats_updated_at TIMESTAMPTZ,
  stats_refresh_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS need_onboarding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS stats_updated_at TIMESTAMPTZ;
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS stats_refresh_requested_at TIMESTAMPTZ;

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  management_email TEXT,
  created_by TEXT,
  customer_id TEXT,
  website TEXT,
  password_policy_config JSONB,
  enforce_encrypted_bundles BOOLEAN NOT NULL DEFAULT false,
  required_encryption_key TEXT CHECK (required_encryption_key IS NULL OR char_length(required_encryption_key) IN (20, 21)),
  stats_updated_at TIMESTAMPTZ,
  last_stats_updated_at TIMESTAMPTZ,
  stats_refresh_requested_at TIMESTAMPTZ,
  has_usage_credits BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS enforce_encrypted_bundles BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS required_encryption_key TEXT CHECK (required_encryption_key IS NULL OR char_length(required_encryption_key) IN (20, 21));
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS stats_updated_at TIMESTAMPTZ;
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS last_stats_updated_at TIMESTAMPTZ;
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS stats_refresh_requested_at TIMESTAMPTZ;

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_metrics_cache (
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  response JSONB NOT NULL DEFAULT '[]'::jsonb,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, start_date, end_date)
);

ALTER TABLE public.app_metrics_cache ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.usage_credit_grants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_credit_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS usage_credit_grants_org_idx
  ON public.usage_credit_grants(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.usage_credit_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS usage_credit_transactions_org_idx
  ON public.usage_credit_transactions(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.usage_overage_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('mau', 'bandwidth', 'storage', 'build_time')),
  overage_amount NUMERIC NOT NULL DEFAULT 0 CHECK (overage_amount >= 0),
  credits_consumed INTEGER NOT NULL DEFAULT 0 CHECK (credits_consumed >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_overage_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS usage_overage_events_org_idx
  ON public.usage_overage_events(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.global_stats (
  date_id TEXT PRIMARY KEY CHECK (date_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  average_ltv DOUBLE PRECISION NOT NULL DEFAULT 0,
  shortest_ltv DOUBLE PRECISION NOT NULL DEFAULT 0,
  longest_ltv DOUBLE PRECISION NOT NULL DEFAULT 0,
  plugin_version_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  plugin_version_ladder JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.plans (
  stripe_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mau BIGINT NOT NULL DEFAULT 0,
  bandwidth BIGINT NOT NULL DEFAULT 0,
  storage BIGINT NOT NULL DEFAULT 0,
  build_time_unit BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

INSERT INTO public.plans (stripe_id, name, mau, bandwidth, storage, build_time_unit)
VALUES ('codepushgo_default_plan', 'Default', 0, 0, 0, 0)
ON CONFLICT (stripe_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.stripe_info (
  customer_id TEXT PRIMARY KEY,
  subscription_id TEXT,
  subscription_anchor_start TIMESTAMPTZ,
  subscription_anchor_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  price_id TEXT,
  product_id TEXT,
  status TEXT,
  is_good_plan BOOLEAN,
  plan_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_info
  ADD COLUMN IF NOT EXISTS plan_calculated_at TIMESTAMPTZ;

ALTER TABLE public.stripe_info ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS stripe_info_subscription_idx
  ON public.stripe_info(subscription_id)
  WHERE subscription_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.daily_revenue_metrics (
  date_id TEXT NOT NULL CHECK (date_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  customer_id TEXT NOT NULL,
  opening_mrr DOUBLE PRECISION NOT NULL DEFAULT 0,
  new_business_mrr DOUBLE PRECISION NOT NULL DEFAULT 0,
  expansion_mrr DOUBLE PRECISION NOT NULL DEFAULT 0,
  contraction_mrr DOUBLE PRECISION NOT NULL DEFAULT 0,
  churn_mrr DOUBLE PRECISION NOT NULL DEFAULT 0,
  churn_mrr_solo DOUBLE PRECISION NOT NULL DEFAULT 0,
  churn_mrr_maker DOUBLE PRECISION NOT NULL DEFAULT 0,
  churn_mrr_team DOUBLE PRECISION NOT NULL DEFAULT 0,
  churn_mrr_enterprise DOUBLE PRECISION NOT NULL DEFAULT 0,
  contraction_mrr_solo DOUBLE PRECISION NOT NULL DEFAULT 0,
  contraction_mrr_maker DOUBLE PRECISION NOT NULL DEFAULT 0,
  contraction_mrr_team DOUBLE PRECISION NOT NULL DEFAULT 0,
  contraction_mrr_enterprise DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date_id, customer_id)
);

ALTER TABLE public.daily_revenue_metrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.build_requests (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  owner_org TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  build_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  builder_job_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.build_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS build_requests_app_job_idx
  ON public.build_requests(app_id, builder_job_id);

CREATE TABLE IF NOT EXISTS public.build_logs (
  build_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  build_time_unit INTEGER NOT NULL CHECK (build_time_unit >= 0),
  billable_seconds INTEGER NOT NULL CHECK (billable_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.build_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS build_logs_org_idx
  ON public.build_logs(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.daily_build_time (
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  build_time_unit INTEGER NOT NULL DEFAULT 0 CHECK (build_time_unit >= 0),
  build_count INTEGER NOT NULL DEFAULT 0 CHECK (build_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, date)
);

ALTER TABLE public.daily_build_time ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.daily_mau (
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  mau INTEGER NOT NULL DEFAULT 0 CHECK (mau >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, date)
);

ALTER TABLE public.daily_mau ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cron_tasks (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  task_type public.cron_task_type NOT NULL,
  target TEXT NOT NULL,
  second_interval INTEGER CHECK (second_interval IS NULL OR second_interval > 0),
  cron TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  healthcheck_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_tasks ENABLE ROW LEVEL SECURITY;



CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  enable_notifications BOOLEAN NOT NULL DEFAULT true,
  opt_for_newsletters BOOLEAN NOT NULL DEFAULT true,
  email_preferences JSONB NOT NULL DEFAULT '{"usage_limit":true,"credit_usage":true,"onboarding":true,"weekly_stats":true,"monthly_stats":true,"deploy_stats_24h":true,"bundle_created":true,"bundle_deployed":true,"device_error":true,"channel_self_rejected":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_via_invite BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.security_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  mfa_email_otp_enforced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.security_settings (id, mfa_email_otp_enforced_at)
VALUES (true, now())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_security (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email_otp_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_can_read_own_security_status
  ON public.user_security
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE TABLE IF NOT EXISTS public.to_delete_accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  removal_date TIMESTAMPTZ NOT NULL,
  removed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

ALTER TABLE public.to_delete_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY to_delete_accounts_deny_all
  ON public.to_delete_accounts
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS to_delete_accounts_removal_date_idx
  ON public.to_delete_accounts(removal_date);

CREATE OR REPLACE FUNCTION public.record_email_otp_verified()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  SELECT auth.uid()::text INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  v_now := now();

  INSERT INTO public.user_security (user_id, email_otp_verified_at, created_at, updated_at)
  VALUES (v_user_id, v_now, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
  SET email_otp_verified_at = EXCLUDED.email_otp_verified_at,
      updated_at = EXCLUDED.updated_at;

  RETURN v_now;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_recent_email_otp_verified(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  verified_at TIMESTAMPTZ;
BEGIN
  SELECT public.user_security.email_otp_verified_at
  INTO verified_at
  FROM public.user_security
  WHERE public.user_security.user_id = p_user_id::text;

  RETURN verified_at IS NOT NULL
    AND verified_at > (now() - INTERVAL '1 hour');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mfa_email_otp_enforced_at()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.security_settings.mfa_email_otp_enforced_at
  FROM public.security_settings
  WHERE public.security_settings.id = true
$$;

CREATE OR REPLACE FUNCTION public.enforce_email_otp_for_mfa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  otp_ok BOOLEAN;
  enforced_at TIMESTAMPTZ;
  user_created_at TIMESTAMPTZ;
BEGIN
  enforced_at := public.get_mfa_email_otp_enforced_at();

  IF enforced_at IS NOT NULL THEN
    SELECT auth.users.created_at
    INTO user_created_at
    FROM auth.users
    WHERE auth.users.id = NEW.user_id;

    IF user_created_at IS NOT NULL AND user_created_at < enforced_at THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'verified') THEN
    otp_ok := public.is_recent_email_otp_verified(NEW.user_id);
    IF NOT otp_ok THEN
      RAISE EXCEPTION 'email otp verification required for mfa enrollment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF has_schema_privilege(current_user, 'auth', 'USAGE')
    AND has_table_privilege(current_user, 'auth.mfa_factors', 'TRIGGER')
    AND has_function_privilege(current_user, 'public.enforce_email_otp_for_mfa()', 'EXECUTE') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_enforce_email_otp_for_mfa ON auth.mfa_factors';
    EXECUTE 'CREATE TRIGGER trg_enforce_email_otp_for_mfa BEFORE INSERT OR UPDATE ON auth.mfa_factors FOR EACH ROW EXECUTE FUNCTION public.enforce_email_otp_for_mfa()';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_id_fn UUID;
  user_email TEXT;
  old_record_json JSONB;
  last_sign_in_at_ts TIMESTAMPTZ;
BEGIN
  SELECT auth.uid() INTO user_id_fn;
  IF user_id_fn IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT auth.users.email, auth.users.last_sign_in_at
  INTO user_email, last_sign_in_at_ts
  FROM auth.users
  WHERE auth.users.id = user_id_fn;

  IF NOT public.is_recent_email_otp_verified(user_id_fn) THEN
    RAISE EXCEPTION 'email_not_verified' USING ERRCODE = 'P0003';
  END IF;

  IF last_sign_in_at_ts IS NULL OR last_sign_in_at_ts < now() - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'reauth_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT row_to_json(u)::jsonb INTO old_record_json
  FROM (SELECT * FROM public.users WHERE id = user_id_fn::text) AS u;

  IF old_record_json IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.to_delete_accounts (account_id, removal_date, removed_data)
  VALUES (
    user_id_fn::text,
    now() + INTERVAL '30 days',
    jsonb_build_object('email', user_email, 'old_record', old_record_json)
  )
  ON CONFLICT (account_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_otp_verified() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_email_otp_verified() FROM anon;
GRANT EXECUTE ON FUNCTION public.record_email_otp_verified() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_otp_verified() TO service_role;

REVOKE ALL ON FUNCTION public.is_recent_email_otp_verified(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_recent_email_otp_verified(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.is_recent_email_otp_verified(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_recent_email_otp_verified(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.get_mfa_email_otp_enforced_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mfa_email_otp_enforced_at() FROM anon;
REVOKE ALL ON FUNCTION public.get_mfa_email_otp_enforced_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_mfa_email_otp_enforced_at() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM authenticated;
REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM service_role;

REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user() TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx
  ON public.users(lower(email));

CREATE TABLE IF NOT EXISTS public.org_users (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_right TEXT DEFAULT 'read',
  rbac_role_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

ALTER TABLE public.org_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS org_users_org_idx
  ON public.org_users(org_id);


CREATE TABLE IF NOT EXISTS public.role_bindings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'group', 'apikey')),
  principal_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('org', 'app', 'channel')),
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  app_id TEXT REFERENCES public.apps(app_id) ON DELETE CASCADE,
  channel_id TEXT,
  reason TEXT,
  is_direct BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.role_bindings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS role_bindings_org_idx
  ON public.role_bindings(org_id);

CREATE INDEX IF NOT EXISTS role_bindings_app_scope_idx
  ON public.role_bindings(app_id, scope_type);

CREATE INDEX IF NOT EXISTS role_bindings_principal_idx
  ON public.role_bindings(principal_type, principal_id);

CREATE TABLE IF NOT EXISTS public.channel_permission_overrides (
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'group', 'apikey')),
  principal_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (principal_type, principal_id, channel_id, permission_key)
);

ALTER TABLE public.channel_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sso_providers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL UNIQUE,
  domain TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  enforce_sso BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sso_providers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS sso_providers_domain_idx
  ON public.sso_providers(lower(domain));

CREATE TABLE IF NOT EXISTS public.tmp_users (
  invite_magic_string TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  future_uuid TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'read',
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tmp_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tmp_users_org_idx
  ON public.tmp_users(org_id);

CREATE TABLE IF NOT EXISTS public.channels (
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT false,
  allow_self_set BOOLEAN NOT NULL DEFAULT true,
  ios BOOLEAN,
  android BOOLEAN,
  electron BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, name)
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS channels_app_public_idx
  ON public.channels(app_id, public, name);

CREATE OR REPLACE FUNCTION public.demote_overlapping_public_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.public IS TRUE THEN
    UPDATE public.channels
    SET public = false,
        updated_at = now()
    WHERE app_id = NEW.app_id
      AND name <> NEW.name
      AND public IS TRUE
      AND (
        (COALESCE(ios, false) IS TRUE AND COALESCE(NEW.ios, false) IS TRUE)
        OR (COALESCE(android, false) IS TRUE AND COALESCE(NEW.android, false) IS TRUE)
        OR (COALESCE(electron, false) IS TRUE AND COALESCE(NEW.electron, false) IS TRUE)
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS demote_overlapping_public_channels_trigger ON public.channels;
CREATE TRIGGER demote_overlapping_public_channels_trigger
BEFORE INSERT OR UPDATE OF public, ios, android, electron ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.demote_overlapping_public_channels();

CREATE TABLE IF NOT EXISTS public.releases (
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  version TEXT NOT NULL CHECK (version ~ '^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)(-((0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)([.](0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?([+]([0-9A-Za-z-]+([.][0-9A-Za-z-]+)*))?$'),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  channel TEXT NOT NULL DEFAULT 'production',
  path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  session_key TEXT,
  key_id TEXT CHECK (key_id IS NULL OR char_length(key_id) <= 20),
  size BIGINT NOT NULL CHECK (size >= 0),
  mandatory BOOLEAN NOT NULL DEFAULT false,
  rollout INTEGER NOT NULL DEFAULT 100 CHECK (rollout >= 1 AND rollout <= 100),
  notes TEXT,
  min_update_version TEXT,
  manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  native_packages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_org TEXT,
  PRIMARY KEY (app_id, platform, channel, version)
);

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS min_update_version TEXT;
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS session_key TEXT;
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS key_id TEXT CHECK (key_id IS NULL OR char_length(key_id) <= 20);
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS manifest JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS native_packages JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS releases_lookup_idx
  ON public.releases(app_id, platform, channel, created_at DESC);
CREATE TABLE IF NOT EXISTS public.version_meta (
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  version_id BIGINT NOT NULL,
  size BIGINT NOT NULL CHECK (size <> 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS version_meta_positive_once_idx
  ON public.version_meta(app_id, version_id)
  WHERE size > 0;

CREATE UNIQUE INDEX IF NOT EXISTS version_meta_negative_once_idx
  ON public.version_meta(app_id, version_id)
  WHERE size < 0;

ALTER TABLE public.version_meta ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.devices (
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  plugin_version TEXT,
  os_version TEXT,
  version_build TEXT,
  version_name TEXT,
  custom_id TEXT,
  is_prod BOOLEAN,
  is_emulator BOOLEAN,
  key_id TEXT CHECK (key_id IS NULL OR char_length(key_id) <= 20),
  default_channel TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, device_id)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS devices_app_updated_idx
  ON public.devices(app_id, updated_at DESC);

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS key_id TEXT CHECK (key_id IS NULL OR char_length(key_id) <= 20);

CREATE TABLE IF NOT EXISTS public.device_channels (
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, device_id)
);

ALTER TABLE public.device_channels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS device_channels_app_channel_idx
  ON public.device_channels(app_id, channel);

CREATE TABLE IF NOT EXISTS public.stats_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  app_id TEXT NOT NULL CHECK (app_id ~ '^[A-Za-z0-9_-]+([.][A-Za-z0-9_-]+)+$'),
  bundle_id TEXT,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  version_name TEXT NOT NULL,
  action TEXT NOT NULL,
  plugin_version TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.console_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  channel TEXT NOT NULL,
  event TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  notify BOOLEAN NOT NULL DEFAULT false,
  notify_console BOOLEAN NOT NULL DEFAULT false,
  org_id TEXT,
  user_id TEXT,
  tracking_version INTEGER,
  tags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.console_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS console_events_created_idx
  ON public.console_events(created_at DESC);

ALTER TABLE public.stats_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS stats_events_app_created_idx
  ON public.stats_events(app_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.apikeys (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  rbac_id UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.apikeys ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS apikeys_key_hash_idx
  ON public.apikeys(key_hash);

CREATE TABLE IF NOT EXISTS public.apikey_bindings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  apikey_id BIGINT NOT NULL REFERENCES public.apikeys(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('org', 'app')),
  org_id TEXT,
  app_id TEXT REFERENCES public.apps(app_id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.apikey_bindings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS apikey_bindings_apikey_idx
  ON public.apikey_bindings(apikey_id);

CREATE INDEX IF NOT EXISTS apikey_bindings_app_idx
  ON public.apikey_bindings(app_id);

CREATE TABLE IF NOT EXISTS public.apikey_global_permissions (
  apikey_id BIGINT NOT NULL REFERENCES public.apikeys(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (apikey_id, permission_key)
);

ALTER TABLE public.apikey_global_permissions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  user_id TEXT,
  org_id TEXT NOT NULL,
  old_record JSONB,
  new_record JSONB,
  changed_fields JSONB
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON public.audit_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_org_table_operation_idx
  ON public.audit_logs(org_id, table_name, operation);
CREATE OR REPLACE FUNCTION public.request_header(header_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  headers JSONB;
BEGIN
  BEGIN
    headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  RETURN headers ->> lower(header_name);
END;
$$;

CREATE OR REPLACE VIEW public.app_versions
WITH (security_barrier = true)
AS
SELECT
  encode(digest(releases.app_id || ':' || releases.platform || ':' || releases.channel || ':' || releases.version, 'sha256'), 'hex') AS id,
  releases.app_id,
  releases.version,
  releases.platform,
  releases.channel,
  releases.path,
  releases.checksum,
  releases.size,
  releases.mandatory,
  releases.rollout,
  releases.notes,
  releases.owner_org,
  releases.created_at
FROM public.releases
WHERE EXISTS (
  SELECT 1
  FROM public.apikeys
  JOIN public.apikey_bindings ON apikey_bindings.apikey_id = apikeys.id
  WHERE apikeys.key_hash = encode(digest(COALESCE(public.request_header('capgkey'), ''), 'sha256'), 'hex')
    AND (apikeys.expires_at IS NULL OR apikeys.expires_at > now())
    AND (
      (apikey_bindings.scope_type = 'app' AND apikey_bindings.app_id = releases.app_id)
      OR (apikey_bindings.scope_type = 'org' AND apikey_bindings.org_id = releases.owner_org)
    )
);

GRANT SELECT ON public.app_versions TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_raw_app_owner_org_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_org IS DISTINCT FROM OLD.owner_org
    AND current_setting('codepushgo.transfer_app', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'owner_org must be changed through public.transfer_app()';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_raw_app_owner_org_update ON public.apps;
CREATE TRIGGER prevent_raw_app_owner_org_update
BEFORE UPDATE OF owner_org ON public.apps
FOR EACH ROW
EXECUTE FUNCTION public.prevent_raw_app_owner_org_update();

CREATE OR REPLACE FUNCTION public.transfer_app(p_app_id TEXT, p_new_org_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner TEXT;
BEGIN
  SELECT owner_org INTO current_owner
  FROM public.apps
  WHERE app_id = p_app_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'app not found';
  END IF;

  PERFORM set_config('codepushgo.transfer_app', 'on', true);

  UPDATE public.apps
  SET owner_org = p_new_org_id,
      transfer_history = COALESCE(transfer_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'fromOrg', current_owner,
        'toOrg', p_new_org_id,
        'transferredAt', now()
      ))
  WHERE app_id = p_app_id;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cron_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_credit_grants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_credit_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_overage_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.global_stats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stripe_info TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_metrics_cache TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_revenue_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.processed_stripe_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.build_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.build_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_build_time TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_mau TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.apps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.channels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.console_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.releases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_channels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stats_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.apikeys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.apikey_bindings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.apikey_global_permissions TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_app(TEXT, TEXT) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orgs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_security TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.to_delete_accounts TO service_role;
GRANT SELECT ON TABLE public.user_security TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_bindings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.channel_permission_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sso_providers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tmp_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_credit_grants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_credit_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.global_stats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stripe_info TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_metrics_cache TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_revenue_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.processed_stripe_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.build_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.build_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_build_time TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('codepushgo-bundles', 'codepushgo-bundles', false)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  public = excluded.public;
CREATE TABLE IF NOT EXISTS public.compatibility_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  org_id TEXT NOT NULL,
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('default_channel_changed', 'default_channel_version_changed')),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'electron')),
  channel_id BIGINT NOT NULL,
  channel_name TEXT NOT NULL,
  current_version_id BIGINT,
  current_version_name TEXT,
  previous_version_id BIGINT,
  previous_version_name TEXT,
  offenders JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_kind TEXT CHECK (resolution_kind IS NULL OR resolution_kind IN ('accepted', 'auto_compatible')),
  resolution_note TEXT
);

ALTER TABLE public.compatibility_events ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS compatibility_events_dedup_idx
  ON public.compatibility_events(app_id, channel_id, platform, current_version_id, previous_version_id, change_occurred_at);

CREATE INDEX IF NOT EXISTS compatibility_events_app_created_idx
  ON public.compatibility_events(app_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compatibility_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.compatibility_events_id_seq TO service_role;

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manifest_count INTEGER NOT NULL DEFAULT 0 CHECK (manifest_count >= 0);

CREATE OR REPLACE FUNCTION public.delete_old_deleted_versions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.releases
  WHERE deleted = true
    AND deleted_at <= now() - INTERVAL '90 days'
    AND manifest_count = 0
    AND size = 0;
$$;

INSERT INTO public.cron_tasks (name, description, task_type, target, cron, timezone, enabled)
VALUES (
  'delete_old_versions',
  'Permanently delete app versions 90 days after soft delete',
  'function',
  'public.delete_old_deleted_versions()',
  '0 3 * * *',
  'UTC',
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  target = EXCLUDED.target,
  cron = EXCLUDED.cron,
  timezone = EXCLUDED.timezone,
  enabled = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_apps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.apps
  WHERE need_onboarding IS TRUE
    AND created_at < now() - INTERVAL '14 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'cleanup_expired_demo_apps: Deleted % expired demo apps', deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_demo_apps() TO service_role;

INSERT INTO public.cron_tasks (name, description, task_type, target, cron, timezone, enabled)
VALUES (
  'cleanup_expired_demo_apps',
  'Delete demo apps older than 14 days',
  'function',
  'public.cleanup_expired_demo_apps()',
  '0 3 * * *',
  'UTC',
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  target = EXCLUDED.target,
  cron = EXCLUDED.cron,
  timezone = EXCLUDED.timezone,
  enabled = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.onboarding_demo_data (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  app_id TEXT NOT NULL REFERENCES public.apps(app_id) ON DELETE CASCADE,
  owner_org TEXT,
  relation_name TEXT NOT NULL CHECK (relation_name IN ('releases', 'channels', 'device_channels', 'devices', 'build_requests', 'stats_events')),
  row_key TEXT NOT NULL,
  seed_id TEXT NOT NULL,
  UNIQUE (app_id, relation_name, row_key)
);

ALTER TABLE public.onboarding_demo_data ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.onboarding_demo_data IS 'Tracks rows created by onboarding demo seeding so demo resets can delete only demo-owned data.';
COMMENT ON COLUMN public.onboarding_demo_data.row_key IS 'Primary-row identifier as text. Only exact rows created or confidently fingerprinted by onboarding demo seeding are tracked.';

DROP POLICY IF EXISTS "Deny user access to onboarding demo data" ON public.onboarding_demo_data;
CREATE POLICY "Deny user access to onboarding demo data"
ON public.onboarding_demo_data
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

REVOKE ALL ON TABLE public.onboarding_demo_data FROM PUBLIC;
REVOKE ALL ON TABLE public.onboarding_demo_data FROM anon;
REVOKE ALL ON TABLE public.onboarding_demo_data FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.onboarding_demo_data TO service_role;

CREATE OR REPLACE FUNCTION public.track_onboarding_demo_data(
  p_app_id TEXT,
  p_owner_org TEXT,
  p_relation_name TEXT,
  p_row_keys TEXT[],
  p_seed_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_app_id IS NULL OR btrim(p_app_id) = '' THEN
    RAISE EXCEPTION 'track_onboarding_demo_data: app_id is required';
  END IF;

  IF p_seed_id IS NULL OR btrim(p_seed_id) = '' THEN
    RAISE EXCEPTION 'track_onboarding_demo_data: seed_id is required';
  END IF;

  IF p_relation_name IS NULL OR p_relation_name NOT IN ('releases', 'channels', 'device_channels', 'devices', 'build_requests', 'stats_events') THEN
    RAISE EXCEPTION 'track_onboarding_demo_data: unsupported relation %', p_relation_name;
  END IF;

  INSERT INTO public.onboarding_demo_data (app_id, owner_org, relation_name, row_key, seed_id)
  SELECT p_app_id, p_owner_org, p_relation_name, key_value, p_seed_id
  FROM unnest(p_row_keys) AS keys(key_value)
  WHERE key_value IS NOT NULL AND btrim(key_value) <> ''
  ON CONFLICT (app_id, relation_name, row_key) DO UPDATE
  SET owner_org = EXCLUDED.owner_org,
      seed_id = EXCLUDED.seed_id,
      created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_legacy_onboarding_demo_data(p_app_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_org TEXT;
BEGIN
  SELECT owner_org INTO v_owner_org
  FROM public.apps
  WHERE app_id = p_app_id
    AND need_onboarding IS TRUE;

  IF p_app_id IS NULL OR v_owner_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.onboarding_demo_data (app_id, owner_org, relation_name, row_key, seed_id)
  SELECT r.app_id, v_owner_org, 'releases', concat_ws(':', r.platform, r.channel, r.version), 'legacy:' || p_app_id
  FROM public.releases r
  WHERE r.app_id = p_app_id
    AND r.path LIKE ('demo/' || p_app_id || '/%')
  ON CONFLICT (app_id, relation_name, row_key) DO NOTHING;

  INSERT INTO public.onboarding_demo_data (app_id, owner_org, relation_name, row_key, seed_id)
  SELECT b.app_id, v_owner_org, 'build_requests', b.id, 'legacy:' || p_app_id
  FROM public.build_requests b
  WHERE b.app_id = p_app_id
    AND b.builder_job_id LIKE ('demo-%' || p_app_id || '%')
  ON CONFLICT (app_id, relation_name, row_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_onboarding_demo_app_data(p_app_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.claim_legacy_onboarding_demo_data(p_app_id);

  DELETE FROM public.stats_events e
  USING public.onboarding_demo_data d
  WHERE d.app_id = p_app_id
    AND d.relation_name = 'stats_events'
    AND e.id::text = d.row_key;

  DELETE FROM public.device_channels dc
  USING public.onboarding_demo_data d
  WHERE d.app_id = p_app_id
    AND d.relation_name = 'device_channels'
    AND dc.app_id = d.app_id
    AND dc.device_id = d.row_key;

  DELETE FROM public.devices dev
  USING public.onboarding_demo_data d
  WHERE d.app_id = p_app_id
    AND d.relation_name = 'devices'
    AND dev.app_id = d.app_id
    AND dev.device_id = d.row_key;

  DELETE FROM public.channels c
  USING public.onboarding_demo_data d
  WHERE d.app_id = p_app_id
    AND d.relation_name = 'channels'
    AND c.app_id = d.app_id
    AND c.name = d.row_key;

  DELETE FROM public.build_requests b
  USING public.onboarding_demo_data d
  WHERE d.app_id = p_app_id
    AND d.relation_name = 'build_requests'
    AND b.id = d.row_key;

  DELETE FROM public.releases r
  USING public.onboarding_demo_data d
  WHERE d.app_id = p_app_id
    AND d.relation_name = 'releases'
    AND r.app_id = d.app_id
    AND concat_ws(':', r.platform, r.channel, r.version) = d.row_key;

  DELETE FROM public.onboarding_demo_data
  WHERE app_id = p_app_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_onboarding_demo_app_data_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.need_onboarding IS TRUE AND NEW.need_onboarding IS FALSE THEN
    PERFORM public.reset_onboarding_demo_app_data(NEW.app_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_onboarding_demo_app_data_on_complete ON public.apps;
CREATE TRIGGER reset_onboarding_demo_app_data_on_complete
AFTER UPDATE OF need_onboarding ON public.apps
FOR EACH ROW
EXECUTE FUNCTION public.reset_onboarding_demo_app_data_on_complete();

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_value JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE 'SELECT decrypted_secret::jsonb FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
    INTO admin_value
    USING 'admin_users';

  IF jsonb_typeof(admin_value) = 'array' THEN
    RETURN admin_value ? p_user_id::text;
  END IF;

  IF jsonb_typeof(admin_value) = 'object' THEN
    RETURN admin_value ? p_user_id::text;
  END IF;

  RETURN false;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_identity_apikey_only(keymode TEXT[] DEFAULT ARRAY['all', 'read', 'write']::TEXT[])
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT apikeys.rbac_id
  FROM public.apikeys
  WHERE apikeys.key_hash = encode(digest(COALESCE(public.request_header('capgkey'), ''), 'sha256'), 'hex')
    AND (apikeys.expires_at IS NULL OR apikeys.expires_at > now())
    AND cardinality(keymode) > 0
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_identity_apikey_only(TEXT[]) TO service_role;

CREATE OR REPLACE FUNCTION public.request_has_org_read_access(orgid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((auth.jwt() ->> 'role') = 'service_role', false)
    OR session_user IS NOT DISTINCT FROM 'postgres'
    OR EXISTS (
      SELECT 1
      FROM public.org_users
      WHERE org_users.org_id = orgid
        AND org_users.user_id = auth.uid()::text
    );
$$;

CREATE OR REPLACE FUNCTION public.get_current_plan_name_org(orgid TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.request_has_org_read_access(orgid) THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT plans.name
    FROM public.orgs
    JOIN public.stripe_info ON stripe_info.customer_id = orgs.customer_id
    JOIN public.plans ON plans.stripe_id = COALESCE(stripe_info.product_id, stripe_info.price_id)
    WHERE orgs.id = orgid
      AND stripe_info.status = 'succeeded'
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cycle_info_org(orgid TEXT)
RETURNS TABLE (
  subscription_anchor_start TIMESTAMPTZ,
  subscription_anchor_end TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.request_has_org_read_access(orgid) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT stripe_info.subscription_anchor_start, stripe_info.subscription_anchor_end
  FROM public.orgs
  JOIN public.stripe_info ON stripe_info.customer_id = orgs.customer_id
  WHERE orgs.id = orgid
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_plan_usage_percent_detailed(orgid TEXT)
RETURNS TABLE (
  total_percent DOUBLE PRECISION,
  mau_percent DOUBLE PRECISION,
  bandwidth_percent DOUBLE PRECISION,
  storage_percent DOUBLE PRECISION,
  build_time_percent DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.request_has_org_read_access(orgid) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 0::DOUBLE PRECISION, 0::DOUBLE PRECISION, 0::DOUBLE PRECISION, 0::DOUBLE PRECISION, 0::DOUBLE PRECISION
  FROM public.orgs
  WHERE orgs.id = orgid
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.request_has_org_read_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_plan_name_org(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_plan_name_org(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_cycle_info_org(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cycle_info_org(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_has_org_read_access(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_plan_name_org(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cycle_info_org(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_allowed_action_org_action(orgid TEXT, actions TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.apikeys
    JOIN public.apikey_bindings ON apikey_bindings.apikey_id = apikeys.id
    WHERE apikeys.rbac_id = public.get_identity_apikey_only()
      AND (apikeys.expires_at IS NULL OR apikeys.expires_at > now())
      AND apikey_bindings.scope_type = 'org'
      AND apikey_bindings.org_id = orgid
      AND cardinality(actions) > 0
  );
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_action_org_action(orgid TEXT, actions TEXT[], appid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN appid IS NULL OR btrim(appid) = '' THEN public.is_allowed_action_org_action(orgid, actions)
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.apps
      WHERE apps.app_id = appid
        AND apps.owner_org = orgid
    ) THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.apikeys
      JOIN public.apikey_bindings ON apikey_bindings.apikey_id = apikeys.id
      WHERE apikeys.rbac_id = public.get_identity_apikey_only()
        AND (apikeys.expires_at IS NULL OR apikeys.expires_at > now())
        AND apikey_bindings.scope_type = 'app'
        AND apikey_bindings.app_id = appid
        AND cardinality(actions) > 0
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[], TEXT) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.webhooks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT ('whsec_' || encode(gen_random_bytes(32), 'base64')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_version TEXT NOT NULL DEFAULT 'legacy' CHECK (delivery_version IN ('legacy', 'standard')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS webhooks_org_id_idx ON public.webhooks(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhooks_enabled_idx ON public.webhooks(org_id, enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  webhook_id TEXT NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  audit_log_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_status INTEGER,
  response_body TEXT,
  response_headers JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  delivery_version TEXT NOT NULL DEFAULT 'legacy' CHECK (delivery_version IN ('legacy', 'standard'))
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_id_idx ON public.webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_org_created_idx ON public.webhook_deliveries(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_retry_idx ON public.webhook_deliveries(status, next_retry_at) WHERE status = 'pending';

REVOKE ALL ON TABLE public.webhooks FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.webhook_deliveries FROM anon, authenticated, public;
GRANT ALL ON TABLE public.webhooks TO service_role;
GRANT ALL ON TABLE public.webhook_deliveries TO service_role;

CREATE POLICY deny_direct_select_on_webhooks
ON public.webhooks AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY deny_direct_insert_on_webhooks
ON public.webhooks AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY deny_direct_update_on_webhooks
ON public.webhooks AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY deny_direct_delete_on_webhooks
ON public.webhooks AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE POLICY deny_direct_select_on_webhook_deliveries
ON public.webhook_deliveries AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY deny_direct_insert_on_webhook_deliveries
ON public.webhook_deliveries AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY deny_direct_update_on_webhook_deliveries
ON public.webhook_deliveries AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY deny_direct_delete_on_webhook_deliveries
ON public.webhook_deliveries AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);


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


DROP POLICY IF EXISTS org_users_read_own_membership ON public.org_users;
CREATE POLICY org_users_read_own_membership
  ON public.org_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS orgs_read_member_orgs ON public.orgs;
CREATE POLICY orgs_read_member_orgs
  ON public.orgs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_users
      WHERE org_users.org_id = orgs.id
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS apps_read_member_org_apps ON public.apps;
CREATE POLICY apps_read_member_org_apps
  ON public.apps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_users
      WHERE org_users.org_id = apps.owner_org
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS releases_read_member_org_releases ON public.releases;
CREATE POLICY releases_read_member_org_releases
  ON public.releases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_users
      WHERE org_users.org_id = releases.owner_org
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS channels_read_member_org_channels ON public.channels;
CREATE POLICY channels_read_member_org_channels
  ON public.channels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.apps
      JOIN public.org_users ON org_users.org_id = apps.owner_org
      WHERE apps.app_id = channels.app_id
        AND org_users.user_id = auth.uid()::text
    )
  );

GRANT SELECT ON TABLE public.org_users TO authenticated;
GRANT SELECT ON TABLE public.orgs TO authenticated;
GRANT SELECT ON TABLE public.apps TO authenticated;
GRANT SELECT ON TABLE public.releases TO authenticated;
GRANT SELECT ON TABLE public.channels TO authenticated;

DROP POLICY IF EXISTS devices_read_member_org_devices ON public.devices;
CREATE POLICY devices_read_member_org_devices
  ON public.devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.apps
      JOIN public.org_users ON org_users.org_id = apps.owner_org
      WHERE apps.app_id = devices.app_id
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS device_channels_read_member_org_device_channels ON public.device_channels;
CREATE POLICY device_channels_read_member_org_device_channels
  ON public.device_channels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.apps
      JOIN public.org_users ON org_users.org_id = apps.owner_org
      WHERE apps.app_id = device_channels.app_id
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS stats_events_read_member_org_stats_events ON public.stats_events;
CREATE POLICY stats_events_read_member_org_stats_events
  ON public.stats_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.apps
      JOIN public.org_users ON org_users.org_id = apps.owner_org
      WHERE apps.app_id = stats_events.app_id
        AND org_users.user_id = auth.uid()::text
    )
  );

GRANT SELECT ON TABLE public.devices TO authenticated;
GRANT SELECT ON TABLE public.device_channels TO authenticated;
GRANT SELECT ON TABLE public.stats_events TO authenticated;
