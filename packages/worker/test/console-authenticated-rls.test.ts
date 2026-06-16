import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(new URL('../../../supabase/migrations/20260616172000_console_authenticated_rls.sql', import.meta.url), 'utf8')

describe('console authenticated RLS migration', () => {
  it('allows authenticated users to read org-scoped console data', () => {
    expect(migrationSql).toContain('CREATE POLICY org_users_read_own_membership')
    expect(migrationSql).toContain('CREATE POLICY apps_read_member_org_apps')
    expect(migrationSql).toContain('CREATE POLICY releases_read_member_org_releases')
    expect(migrationSql).toContain('GRANT SELECT ON TABLE public.apps TO authenticated')
  })

  it('scopes app and release access through org membership', () => {
    expect(migrationSql).toContain('org_users.org_id = apps.owner_org')
    expect(migrationSql).toContain('org_users.org_id = releases.owner_org')
    expect(migrationSql).toContain('org_users.user_id = auth.uid()::text')
  })
})
