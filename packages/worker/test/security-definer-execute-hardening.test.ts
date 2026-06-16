import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('[Capgo parity] security definer execute hardening', () => {
  it('keeps service-only onboarding cleanup helpers revoked from public callers', () => {
    for (const signature of [
      'public.cleanup_expired_demo_apps()',
      'public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT)',
      'public.claim_legacy_onboarding_demo_data(TEXT)',
      'public.reset_onboarding_demo_app_data(TEXT)',
    ]) {
      expect(migrationSql).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC`)
      expect(migrationSql).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM anon`)
      expect(migrationSql).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM authenticated`)
    }
  })

  it('keeps API-key identity lookup service-role only', () => {
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM anon')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM authenticated')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_identity_apikey_only(TEXT[]) TO service_role')
  })

  it('does not expose plan helper execution to public or anon callers', () => {
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_current_plan_name_org(TEXT) FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_current_plan_name_org(TEXT) FROM anon')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_cycle_info_org(TEXT) FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) FROM PUBLIC')
  })
})
