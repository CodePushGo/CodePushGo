import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('[Capgo parity] plan-check appid passthrough RPC', () => {
  it('keeps the old two-argument function shape for CLI compatibility', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.is_allowed_action_org_action(orgid TEXT, actions TEXT[])')
    expect(migrationSql).toContain('AND apikey_bindings.scope_type = \'org\'')
    expect(migrationSql).toContain('AND apikey_bindings.org_id = orgid')
  })

  it('adds a three-argument overload that checks the supplied app id against app-scoped bindings', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.is_allowed_action_org_action(orgid TEXT, actions TEXT[], appid TEXT)')
    expect(migrationSql).toContain('THEN public.is_allowed_action_org_action(orgid, actions)')
    expect(migrationSql).toContain('WHERE apps.app_id = appid')
    expect(migrationSql).toContain('AND apps.owner_org = orgid')
    expect(migrationSql).toContain('AND apikey_bindings.scope_type = \'app\'')
    expect(migrationSql).toContain('AND apikey_bindings.app_id = appid')
  })

  it('allows anon Supabase RPC callers while keeping the helper security-definer scoped', () => {
    expect(migrationSql).toContain('SECURITY DEFINER')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[]) FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[], TEXT) FROM PUBLIC')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[]) TO anon, authenticated, service_role')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.is_allowed_action_org_action(TEXT, TEXT[], TEXT) TO anon, authenticated, service_role')
  })
})
