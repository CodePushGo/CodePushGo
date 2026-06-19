import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

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
