import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('[Capgo parity] get_identity_apikey_only RPC permissions', () => {
  it('keeps API-key identity lookup in the single migration and resolves only from capgkey', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_identity_apikey_only')
    expect(migrationSql).toContain("public.request_header('capgkey')")
    expect(migrationSql).toContain("encode(extensions.digest(COALESCE(public.request_header('capgkey'), ''), 'sha256'), 'hex')")
    expect(migrationSql).toContain('SELECT apikeys.rbac_id')
    expect(migrationSql).toContain('AND (apikeys.expires_at IS NULL OR apikeys.expires_at > now())')
  })

  it('denies anon and authenticated callers while allowing service_role', () => {
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM anon')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_identity_apikey_only(TEXT[]) FROM authenticated')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_identity_apikey_only(TEXT[]) TO service_role')
  })
})
