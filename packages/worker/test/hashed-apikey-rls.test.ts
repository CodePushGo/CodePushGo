import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('[Capgo parity] hashed API key RLS support', () => {
  it('stores only hashed API keys in the consolidated schema', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.apikeys')
    expect(migrationSql).toContain('key_hash TEXT NOT NULL UNIQUE')
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS apikeys_key_hash_idx')
    expect(migrationSql).not.toMatch(/\n\s+key\s+TEXT\s+NOT NULL/i)
  })

  it('resolves API key identity from the capgkey header hash', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_identity_apikey_only')
    expect(migrationSql).toContain("public.request_header('capgkey')")
    expect(migrationSql).toContain("encode(digest(COALESCE(public.request_header('capgkey'), ''), 'sha256'), 'hex')")
    expect(migrationSql).toContain('SELECT apikeys.rbac_id')
  })

  it('uses hashed API key checks for compatible release reads', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE VIEW public.app_versions')
    expect(migrationSql).toContain('JOIN public.apikey_bindings ON apikey_bindings.apikey_id = apikeys.id')
    expect(migrationSql).toContain('apikeys.key_hash = encode(digest(COALESCE(public.request_header(\'capgkey\'), \'\'), \'sha256\'), \'hex\')')
    expect(migrationSql).toContain('(apikey_bindings.scope_type = \'app\' AND apikey_bindings.app_id = releases.app_id)')
    expect(migrationSql).toContain('(apikey_bindings.scope_type = \'org\' AND apikey_bindings.org_id = releases.owner_org)')
  })
})
