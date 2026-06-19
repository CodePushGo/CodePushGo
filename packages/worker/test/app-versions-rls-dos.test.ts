import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

function keyHeaders(key: string) {
  return { capgkey: key, 'content-type': 'application/json' }
}

async function seedAppVersion() {
  const ctx = testApp()
  const appId = `com.rls.dos.${crypto.randomUUID()}`
  const createApp = await ctx.app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  expect(createApp.status).toBe(200)

  const createBundle = await ctx.app.request('https://api.test/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      app_id: appId,
      version: '1.0.0',
      external_url: 'https://example.com/rls-dos.zip',
      checksum: 'abc123',
    }),
  }, ctx.env)
  expect(createBundle.status).toBe(200)

  const createKey = await ctx.app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `rls-dos-key-${crypto.randomUUID()}`,
      bindings: [{ role_name: 'app_reader', scope_type: 'app', org_id: 'default-org', app_id: appId }],
    }),
  }, ctx.env)
  expect(createKey.status).toBe(200)
  const apiKey = await createKey.json() as { key: string }
  return { ...ctx, appId, key: apiKey.key }
}

describe('[Capgo parity] app_versions RLS DoS regression', () => {
  it('defines app_versions as the real Capgo table with upload/read policies', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public"."app_versions"')
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public"."app_versions_meta"')
    expect(migrationSql).toContain('ALTER TABLE "public"."app_versions" ENABLE ROW LEVEL SECURITY')
    expect(migrationSql).toContain('CREATE INDEX "idx_app_versions_retention_cleanup"')
    expect(migrationSql).not.toContain('CREATE OR REPLACE VIEW public.app_versions')
  })

  it('keeps unauthenticated parallel version probes empty and bounded', async () => {
    const { app, env } = await seedAppVersion()
    const responses = await Promise.all(Array.from({ length: 8 }, () => app.request('https://api.test/bundle?app_id=com.rls.dos.missing', { headers: authHeaders }, env)))

    for (const response of responses) {
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'cannot_get_bundle' })
    }
  })

  it('keeps API-key scoped version reads working', async () => {
    const { app, env, appId, key } = await seedAppVersion()
    const response = await app.request(`https://api.test/bundle?app_id=${appId}`, { headers: keyHeaders(key) }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as Array<{ app_id: string }>
    expect(body.length).toBeGreaterThan(0)
    expect(body.every((row) => row.app_id === appId)).toBe(true)
  })
})
