import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] onboarding demo reset provenance', () => {
  it('tracks demo-owned rows instead of deleting app-wide data', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.onboarding_demo_data')
    expect(migrationSql).toContain("COMMENT ON TABLE public.onboarding_demo_data IS 'Tracks rows created by onboarding demo seeding so demo resets can delete only demo-owned data.'")
    expect(migrationSql).toContain("relation_name TEXT NOT NULL CHECK (relation_name IN ('releases', 'channels', 'device_channels', 'devices', 'build_requests', 'stats_events'))")
    expect(migrationSql).toContain('UNIQUE (app_id, relation_name, row_key)')
    expect(migrationSql).toContain('CREATE POLICY "Deny user access to onboarding demo data"')
  })

  it('exposes a service-role-only tracking RPC', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.track_onboarding_demo_data')
    expect(migrationSql).toContain('RAISE EXCEPTION \'track_onboarding_demo_data: unsupported relation %\'')
    expect(migrationSql).toContain('ON CONFLICT (app_id, relation_name, row_key) DO UPDATE')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC;')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM anon;')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM authenticated;')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.track_onboarding_demo_data(TEXT, TEXT, TEXT, TEXT[], TEXT) TO service_role;')
  })

  it('resets only rows listed in onboarding_demo_data for CodePushGo tables', () => {
    const resetBody = migrationSql.match(/CREATE OR REPLACE FUNCTION public\.reset_onboarding_demo_app_data\(p_app_id TEXT\)[\s\S]+?REVOKE ALL ON FUNCTION public\.reset_onboarding_demo_app_data\(TEXT\) FROM PUBLIC;/)?.[0] ?? ''

    expect(resetBody).toContain('PERFORM public.claim_legacy_onboarding_demo_data(p_app_id);')
    expect(resetBody).toContain("d.relation_name = 'stats_events'")
    expect(resetBody).toContain("d.relation_name = 'device_channels'")
    expect(resetBody).toContain("d.relation_name = 'devices'")
    expect(resetBody).toContain("d.relation_name = 'channels'")
    expect(resetBody).toContain("d.relation_name = 'build_requests'")
    expect(resetBody).toContain("d.relation_name = 'releases'")
    expect(resetBody).toContain("concat_ws(':', r.platform, r.channel, r.version) = d.row_key")
    expect(resetBody).not.toContain('DELETE FROM public.apps')
  })

  it('claims only hard legacy demo markers and clears demo data when onboarding completes', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.claim_legacy_onboarding_demo_data(p_app_id TEXT)')
    expect(migrationSql).toContain("r.path LIKE ('demo/' || p_app_id || '/%')")
    expect(migrationSql).toContain("b.builder_job_id LIKE ('demo-%' || p_app_id || '%')")
    expect(migrationSql).toContain('CREATE TRIGGER reset_onboarding_demo_app_data_on_complete')
    expect(migrationSql).toContain('AFTER UPDATE OF need_onboarding ON public.apps')
    expect(migrationSql).toContain('PERFORM public.reset_onboarding_demo_app_data(NEW.app_id);')
  })

  it('keeps reset and legacy-claim RPCs service-role only', () => {
    for (const fn of ['reset_onboarding_demo_app_data(TEXT)', 'claim_legacy_onboarding_demo_data(TEXT)']) {
      expect(migrationSql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC;`)
      expect(migrationSql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM anon;`)
      expect(migrationSql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM authenticated;`)
      expect(migrationSql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`)
    }
  })
})
