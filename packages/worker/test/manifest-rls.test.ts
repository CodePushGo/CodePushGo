import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')
const manifest = [{ file_name: 'entry.js', s3_path: 'assets/entry.js', file_hash: 'hash-entry' }]

async function seedManifestRelease() {
  const ctx = testApp()
  const appId = 'com.manifest.rls.worker'
  await ctx.app.request('/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  const upload = await ctx.app.request('/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      app_id: appId,
      channel: 'production',
      checksum: 'manifest-rls-checksum',
      external_url: 'https://updates.example/manifest.zip',
      manifest,
      platform: 'ios',
      version: '2.0.0',
    }),
  }, ctx.env)
  expect(upload.status).toBe(200)
  return { ...ctx, appId }
}

describe('[Capgo parity] manifest access guards', () => {
  it('does not expose a direct Supabase manifest table in the consolidated Worker schema', () => {
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.manifest')
    expect(migrationSql).toContain('manifest JSONB')
    expect(migrationSql).toContain('manifest_count INTEGER NOT NULL DEFAULT 0')
  })

  it('rejects malformed direct manifest trigger writes', async () => {
    const { app, env } = testApp()
    const response = await app.request('/triggers/on_manifest_create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'manifest', type: 'INSERT', record: { id: 'manifest-id' } }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'no_app_version_id_or_s3_path' })
  })

  it('serves manifest entries only through update responses for compatible plugin versions', async () => {
    const ctx = await seedManifestRelease()
    const oldPlugin = await ctx.app.request('/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: ctx.appId, defaultChannel: 'production', device_id: 'device-old', platform: 'ios', plugin_version: '6.7.0', version_build: '1.0.0', version_name: '1.0.0' }),
    }, ctx.env)
    expect(oldPlugin.status).toBe(200)
    expect((await oldPlugin.json() as { manifest?: unknown }).manifest).toBeUndefined()

    const newPlugin = await ctx.app.request('/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: ctx.appId, defaultChannel: 'production', device_id: 'device-new', platform: 'ios', plugin_version: '6.25.0', version_build: '1.0.0', version_name: '1.0.0' }),
    }, ctx.env)
    expect(newPlugin.status).toBe(200)
    expect(await newPlugin.json()).toMatchObject({ manifest: [expect.objectContaining({ file_name: 'entry.js', file_hash: 'hash-entry' })] })
  })
})
