import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] MFA email OTP trigger wiring', () => {
  it('uses public.enforce_email_otp_for_mfa() for auth.mfa_factors', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.enforce_email_otp_for_mfa()')
    expect(migrationSql).toContain('DROP TRIGGER IF EXISTS trg_enforce_email_otp_for_mfa ON auth.mfa_factors')
    expect(migrationSql).toContain('CREATE TRIGGER trg_enforce_email_otp_for_mfa BEFORE INSERT OR UPDATE ON auth.mfa_factors FOR EACH ROW EXECUTE FUNCTION public.enforce_email_otp_for_mfa()')
  })

  it('does not expose direct execute privileges on the trigger helper', () => {
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM anon')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM authenticated')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.enforce_email_otp_for_mfa() FROM service_role')
  })
})
