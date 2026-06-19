import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] email OTP verification persistence', () => {
  it('stores successful email OTP verification timestamps in user_security', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.user_security')
    expect(migrationSql).toContain('email_otp_verified_at TIMESTAMPTZ')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.record_email_otp_verified()')
    expect(migrationSql).toContain('INSERT INTO public.user_security (user_id, email_otp_verified_at, created_at, updated_at)')
    expect(migrationSql).toContain('ON CONFLICT (user_id) DO UPDATE')
  })

  it('checks recent OTP verification without exposing the helper publicly', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.is_recent_email_otp_verified(p_user_id UUID)')
    expect(migrationSql).toContain("AND verified_at > (now() - INTERVAL '1 hour')")
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.is_recent_email_otp_verified(UUID) FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.is_recent_email_otp_verified(UUID) FROM authenticated')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.is_recent_email_otp_verified(UUID) TO service_role')
  })
})
