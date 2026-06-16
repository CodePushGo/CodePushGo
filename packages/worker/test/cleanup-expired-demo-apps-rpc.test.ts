import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('cleanup_expired_demo_apps RPC authorization', () => {
  it('keeps execute privilege only for service-role callers', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_apps()')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM PUBLIC;')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM anon;')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM authenticated;')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.cleanup_expired_demo_apps() TO service_role;')
  })

  it('registers the cleanup function as a Cloudflare Worker cron task target', () => {
    expect(migration).toContain("'cleanup_expired_demo_apps'")
    expect(migration).toContain("'public.cleanup_expired_demo_apps()'")
    expect(migration).toContain("'Delete demo apps older than 14 days'")
  })
})
