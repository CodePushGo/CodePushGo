import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] plan usage org RPC authorization', () => {
  it('keeps the plan usage support tables in the consolidated migration', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.plans')
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.app_metrics_cache')
    expect(migrationSql).toContain('product_id TEXT')
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plans TO service_role')
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_metrics_cache TO service_role')
  })

  it('allows authenticated org members to read plan usage RPCs through a shared access helper', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.request_has_org_read_access(orgid TEXT)')
    expect(migrationSql).toContain("(auth.jwt() ->> 'role') = 'service_role'")
    expect(migrationSql).toContain('org_users.org_id = orgid')
    expect(migrationSql).toContain('org_users.user_id = auth.uid()::text')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_current_plan_name_org(orgid TEXT)')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_cycle_info_org(orgid TEXT)')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_plan_usage_percent_detailed(orgid TEXT)')
  })

  it('returns no cross-tenant data for unauthorized users', () => {
    expect(migrationSql).toContain('IF NOT public.request_has_org_read_access(orgid) THEN')
    expect(migrationSql).toContain('RETURN NULL;')
    expect(migrationSql).toContain('RETURN;')
  })

  it('rejects anonymous execution of the hardened RPCs', () => {
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_current_plan_name_org(TEXT) FROM anon')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_cycle_info_org(TEXT) FROM anon')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) FROM anon')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_current_plan_name_org(TEXT) TO authenticated, service_role')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_cycle_info_org(TEXT) TO authenticated, service_role')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_plan_usage_percent_detailed(TEXT) TO authenticated, service_role')
  })
})
