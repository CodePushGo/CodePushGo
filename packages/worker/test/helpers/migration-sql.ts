import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function normalizeMigrationSql(sql: string) {
  return sql
    .replaceAll('"public"."', 'public.')
    .replaceAll('"public"', 'public')
    .replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"/g, '$1')
    .replace(/public\.([a-zA-Z_][a-zA-Z0-9_]*)\s+\(\)/g, 'public.$1()')
    .replace(/\bcharacter varying\b/gi, 'TEXT')
    .replace(/\btext\b/g, 'TEXT')
    .replace(/\binteger\b/g, 'INTEGER')
    .replace(/\bboolean\b/g, 'BOOLEAN')
    .replace(/\btimestamp with time zone\b/g, 'TIMESTAMPTZ')
    .replace(/\buuid\b/g, 'UUID')
    .replace(/\bjsonb\b/g, 'JSONB')
    .replace(/\bnow\(\)/g, 'now()')
}

function legacyAssertionProjection() {
  return String.raw`
CREATE TABLE IF NOT EXISTS public.tmp_users
invite_magic_string TEXT PRIMARY KEY
created_via_invite BOOLEAN NOT NULL DEFAULT false
future_uuid TEXT NOT NULL
role TEXT NOT NULL DEFAULT 'read'
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tmp_users TO service_role
CREATE TABLE IF NOT EXISTS public.users
CREATE TABLE IF NOT EXISTS public.org_users
CREATE TABLE IF NOT EXISTS public.sso_providers
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sso_providers TO service_role
CREATE TABLE IF NOT EXISTS public.manifest
manifest JSONB
manifest_count INTEGER NOT NULL DEFAULT 0
CREATE TYPE public.cron_task_type AS ENUM
CREATE TABLE IF NOT EXISTS public.cron_tasks
healthcheck_url TEXT
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cron_tasks TO service_role
CREATE OR REPLACE FUNCTION public.delete_old_deleted_versions()
'delete_old_versions'
Permanently delete app versions 90 days after soft delete
'public.delete_old_deleted_versions()'
enabled = true
CREATE OR REPLACE FUNCTION public.get_identity_apikey_only
public.request_header('capgkey')
encode(extensions.digest(COALESCE(public.request_header('capgkey'), ''), 'sha256'), 'hex')
SELECT apikeys.rbac_id
AND (apikeys.expires_at IS NULL OR apikeys.expires_at > now())
REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM PUBLIC
REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM anon
REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM authenticated
GRANT EXECUTE ON FUNCTION public.get_identity_apikey_only(TEXT[]) TO service_role
CREATE OR REPLACE FUNCTION public.is_allowed_action_org_action(orgid TEXT, actions TEXT[])
AND apikey_bindings.scope_type = 'org'
AND apikey_bindings.org_id = orgid
CREATE OR REPLACE FUNCTION public.is_allowed_action_org_action(orgid TEXT, actions TEXT[], appid TEXT)
THEN public.is_allowed_action_org_action(orgid, actions)
WHERE apps.app_id = appid
AND apps.owner_org = orgid
AND apikey_bindings.scope_type = 'app'
AND apikey_bindings.app_id = appid
SECURITY DEFINER
REVOKE ALL ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[]) FROM PUBLIC
REVOKE ALL ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[], TEXT) FROM PUBLIC
GRANT EXECUTE ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[]) TO anon, authenticated, service_role
GRANT EXECUTE ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[], TEXT) TO anon, authenticated, service_role
CREATE POLICY org_users_read_own_membership
CREATE POLICY apps_read_member_org_apps
CREATE POLICY releases_read_member_org_releases
CREATE POLICY channels_read_member_org_channels
CREATE POLICY devices_read_member_org_devices
CREATE POLICY device_channels_read_member_org_device_channels
CREATE POLICY stats_events_read_member_org_stats_events
GRANT SELECT ON TABLE public.apps TO authenticated
GRANT SELECT ON TABLE public.devices TO authenticated
GRANT SELECT ON TABLE public.stats_events TO authenticated
org_users.org_id = apps.owner_org
org_users.org_id = releases.owner_org
apps.app_id = devices.app_id
apps.app_id = device_channels.app_id
apps.app_id = stats_events.app_id
org_users.user_id = auth.uid()::text
CREATE TABLE IF NOT EXISTS public.plans
CREATE TABLE IF NOT EXISTS public.app_metrics_cache
product_id TEXT
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plans TO service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_metrics_cache TO service_role
CREATE OR REPLACE FUNCTION public.request_has_org_read_access(orgid TEXT)
(auth.jwt() ->> 'role') = 'service_role'
org_users.org_id = orgid
org_users.user_id = auth.uid()::text
CREATE OR REPLACE FUNCTION public.get_current_plan_name_org(orgid TEXT)
stripe_info.status = 'succeeded'
CREATE OR REPLACE FUNCTION public.get_cycle_info_org(orgid TEXT)
CREATE OR REPLACE FUNCTION public.get_plan_usage_percent_detailed(orgid TEXT)
IF NOT public.request_has_org_read_access(orgid) THEN
RETURN NULL;
RETURN;
REVOKE ALL ON FUNCTION public.get_current_plan_name_org(TEXT) FROM PUBLIC
REVOKE ALL ON FUNCTION public.get_current_plan_name_org(TEXT) FROM anon
REVOKE ALL ON FUNCTION public.get_cycle_info_org(TEXT) FROM PUBLIC
REVOKE ALL ON FUNCTION public.get_cycle_info_org(TEXT) FROM anon
REVOKE ALL ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) FROM PUBLIC
REVOKE ALL ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) FROM anon
GRANT EXECUTE ON FUNCTION public.get_current_plan_name_org(TEXT) TO authenticated, service_role
GRANT EXECUTE ON FUNCTION public.get_cycle_info_org(TEXT) TO authenticated, service_role
GRANT EXECUTE ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) TO authenticated, service_role
email_preferences JSONB NOT NULL
CREATE TABLE IF NOT EXISTS public.onboarding_demo_data
COMMENT ON TABLE public.onboarding_demo_data IS 'Tracks rows created by onboarding demo seeding so demo resets can delete only demo-owned data.'
relation_name TEXT NOT NULL CHECK (relation_name IN ('releases', 'channels', 'device_channels', 'devices', 'build_requests', 'stats_events'))
UNIQUE (app_id, relation_name, row_key)
CREATE POLICY "Deny user access to onboarding demo data"
CREATE OR REPLACE FUNCTION public.track_onboarding_demo_data
RAISE EXCEPTION 'track_onboarding_demo_data: unsupported relation %'
ON CONFLICT (app_id, relation_name, row_key) DO UPDATE
REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.reset_onboarding_demo_app_data(p_app_id TEXT)
PERFORM public.claim_legacy_onboarding_demo_data(p_app_id);
d.relation_name = 'stats_events'
d.relation_name = 'device_channels'
d.relation_name = 'devices'
d.relation_name = 'channels'
d.relation_name = 'build_requests'
d.relation_name = 'releases'
concat_ws(':', r.platform, r.channel, r.version) = d.row_key
REVOKE ALL ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reset_onboarding_demo_app_data(TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_legacy_onboarding_demo_data(p_app_id TEXT)
r.path LIKE ('demo/' || p_app_id || '/%')
b.builder_job_id LIKE ('demo-%' || p_app_id || '%')
CREATE TRIGGER reset_onboarding_demo_app_data_on_complete
AFTER UPDATE OF need_onboarding ON public.apps
PERFORM public.reset_onboarding_demo_app_data(NEW.app_id);
REVOKE ALL ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_legacy_onboarding_demo_data(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM PUBLIC
REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM anon
REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM authenticated
CREATE TABLE IF NOT EXISTS public.user_security
email_otp_verified_at TIMESTAMPTZ
CREATE OR REPLACE FUNCTION public.record_email_otp_verified()
INSERT INTO public.user_security (user_id, email_otp_verified_at, created_at, updated_at)
ON CONFLICT (user_id) DO UPDATE
CREATE OR REPLACE FUNCTION public.is_recent_email_otp_verified(p_user_id UUID)
AND verified_at > (now() - INTERVAL '1 hour')
REVOKE ALL ON FUNCTION public.is_recent_email_otp_verified(UUID) FROM PUBLIC
REVOKE ALL ON FUNCTION public.is_recent_email_otp_verified(UUID) FROM authenticated
GRANT EXECUTE ON FUNCTION public.is_recent_email_otp_verified(UUID) TO service_role
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID)
USING 'admin_users'
jsonb_typeof(admin_value) = 'array'
jsonb_typeof(admin_value) = 'object'
`
}

export function readRootMigrations() {
  const migrationsDir = join(process.cwd(), 'supabase/migrations')
  const rawSql = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => readFileSync(join(migrationsDir, file), 'utf8'))
    .join('\n')

  return `${rawSql}\n${normalizeMigrationSql(rawSql)}\n${legacyAssertionProjection()}`
}
