import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migration = readRootMigrations()

describe('cleanup_expired_demo_apps RPC authorization', () => {
  it('keeps execute privilege only for service-role callers', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_apps()')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM PUBLIC;')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.cleanup_expired_demo_apps() FROM ANON;')
    expect(migration).toContain('REVOKE ALL ON FUNCTION "public"."cleanup_expired_demo_apps"() FROM AUTHENTICATED;')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION "public"."cleanup_expired_demo_apps"() TO "service_role";')
  })

  it('registers the cleanup function as a Cloudflare Worker cron task target', () => {
    expect(migration).toContain("'cleanup_expired_demo_apps'")
    expect(migration).toContain("'public.cleanup_expired_demo_apps()'")
    expect(migration).toContain('Delete demo apps (app_id starts with com.capdemo.) older than 14 days')
  })
})
