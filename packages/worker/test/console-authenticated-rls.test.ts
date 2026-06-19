import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('console authenticated RLS migration', () => {
  it('allows authenticated users to read org-scoped console data', () => {
    expect(migrationSql).toContain('CREATE POLICY org_users_read_own_membership')
    expect(migrationSql).toContain('CREATE POLICY apps_read_member_org_apps')
    expect(migrationSql).toContain('CREATE POLICY releases_read_member_org_releases')
    expect(migrationSql).toContain('CREATE POLICY channels_read_member_org_channels')
    expect(migrationSql).toContain('CREATE POLICY devices_read_member_org_devices')
    expect(migrationSql).toContain('CREATE POLICY device_channels_read_member_org_device_channels')
    expect(migrationSql).toContain('CREATE POLICY stats_events_read_member_org_stats_events')
    expect(migrationSql).toContain('GRANT SELECT ON TABLE public.apps TO authenticated')
    expect(migrationSql).toContain('GRANT SELECT ON TABLE public.devices TO authenticated')
    expect(migrationSql).toContain('GRANT SELECT ON TABLE public.stats_events TO authenticated')
  })

  it('scopes app, release, device, and stats access through org membership', () => {
    expect(migrationSql).toContain('org_users.org_id = apps.owner_org')
    expect(migrationSql).toContain('org_users.org_id = releases.owner_org')
    expect(migrationSql).toContain('apps.app_id = devices.app_id')
    expect(migrationSql).toContain('apps.app_id = device_channels.app_id')
    expect(migrationSql).toContain('apps.app_id = stats_events.app_id')
    expect(migrationSql).toContain('org_users.user_id = auth.uid()::text')
  })
})
