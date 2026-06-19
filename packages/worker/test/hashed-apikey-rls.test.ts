import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] hashed API key RLS support', () => {
  it('adds hashed API key storage to the Capgo apikey table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public"."apikeys"')
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "key_hash" text')
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS idx_apikeys_key_hash')
    expect(migrationSql).toContain('CHECK (key IS NOT NULL OR key_hash IS NOT NULL)')
  })

  it('resolves API key identity from plain or hashed capgkey values', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION "public"."get_identity_apikey_only"')
    expect(migrationSql).toContain('SELECT "public"."get_apikey_header"() into api_key_text;')
    expect(migrationSql).toContain('SELECT * FROM public.find_apikey_by_value(api_key_text) INTO api_key;')
    expect(migrationSql).toContain("key_hash = encode(extensions.digest(key_value, 'sha256'), 'hex')")
  })

  it('uses RBAC helpers for app_versions reads instead of a compatibility view', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public"."app_versions"')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION "public"."app_versions_has_app_permission"')
    expect(migrationSql).toContain('public.app_versions_has_app_permission(')
    expect(migrationSql).not.toContain('CREATE OR REPLACE VIEW public.app_versions')
  })
})
