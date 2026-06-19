import { describe, expect, it } from 'vitest'
import { isPlatformAdminSecretValue } from '../src/platform-admin'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] is_platform_admin function', () => {
  it('matches Capgo admin_users array and object semantics', () => {
    expect(isPlatformAdminSecretValue(['user-1', 'user-2'], 'user-1')).toBe(true)
    expect(isPlatformAdminSecretValue({ 'user-1': true }, 'user-1')).toBe(true)
    expect(isPlatformAdminSecretValue({ 'user-1': false }, 'user-1')).toBe(true)
    expect(isPlatformAdminSecretValue(['user-2'], 'user-1')).toBe(false)
    expect(isPlatformAdminSecretValue({ 'user-2': true }, 'user-1')).toBe(false)
    expect(isPlatformAdminSecretValue(null, 'user-1')).toBe(false)
    expect(isPlatformAdminSecretValue(['user-1'], undefined)).toBe(false)
  })

  it('keeps is_platform_admin in the single Supabase migration and tied to vault admin_users', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID)')
    expect(migrationSql).toContain("USING 'admin_users'")
    expect(migrationSql).toContain("jsonb_typeof(admin_value) = 'array'")
    expect(migrationSql).toContain("jsonb_typeof(admin_value) = 'object'")
    expect(migrationSql).not.toContain('is_platform_admin_role_binding')
  })
})
