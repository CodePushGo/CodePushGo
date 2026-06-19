import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] delete_user reauthentication guards', () => {
  it('requires recent email OTP verification and recent sign-in before scheduling deletion', () => {
    expect(migrationSql).toContain('CREATE TABLE public.to_delete_accounts')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION "public"."delete_user" ()')
    expect(migrationSql).toContain('IF NOT "public"."is_recent_email_otp_verified"(user_id_fn) THEN')
    expect(migrationSql).toContain("RAISE EXCEPTION 'email_not_verified'")
    expect(migrationSql).toContain("last_sign_in_at_ts < NOW() - INTERVAL '5 minutes'")
    expect(migrationSql).toContain("RAISE EXCEPTION 'reauth_required'")
    expect(migrationSql).toContain("NOW() + INTERVAL '30 days'")
  })

  it('keeps delete_user callable by authenticated users but not public or anon', () => {
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.delete_user() FROM ANON')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.delete_user() TO AUTHENTICATED')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.delete_user() TO SERVICE_ROLE')
  })
})
