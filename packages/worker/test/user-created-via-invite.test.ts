import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('[Capgo parity] users.created_via_invite', () => {
  it('defaults normal user inserts to self-signup semantics', () => {
    expect(migrationSql).toContain('created_via_invite BOOLEAN NOT NULL DEFAULT false')
  })

  it('keeps invite acceptance on the Worker route instead of a Supabase Edge Function', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.tmp_users')
    expect(migrationSql).toContain('future_uuid TEXT NOT NULL')
    expect(migrationSql).toContain('role TEXT NOT NULL DEFAULT \'read\'')
  })
})
