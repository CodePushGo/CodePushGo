import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('[Capgo parity] delete_user reauthentication guards', () => {
  it('requires recent email OTP verification and recent sign-in before scheduling deletion', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.to_delete_accounts')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.delete_user()')
    expect(migrationSql).toContain('IF NOT public.is_recent_email_otp_verified(user_id_fn) THEN')
    expect(migrationSql).toContain("RAISE EXCEPTION 'email_not_verified'")
    expect(migrationSql).toContain("last_sign_in_at_ts < now() - INTERVAL '5 minutes'")
    expect(migrationSql).toContain("RAISE EXCEPTION 'reauth_required'")
    expect(migrationSql).toContain("now() + INTERVAL '30 days'")
  })

  it('keeps delete_user callable by authenticated users but not public or anon', () => {
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC')
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.delete_user() FROM anon')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated')
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.delete_user() TO service_role')
  })
})
