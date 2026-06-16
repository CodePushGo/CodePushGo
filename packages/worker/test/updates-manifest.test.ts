import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const manifest = [{ file_name: 'test', s3_path: 'test_file.html', file_hash: '1234567890' }]

async function seedManifestApp() {
  const ctx = testApp()
  const appId = 'com.demo.app.updates.manifest'
  await ctx.app.request('/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  return { ...ctx, appId }
}

async function createRelease(ctx: Awaited<ReturnType<typeof seedManifestApp>>, input: { manifest?: typeof manifest, version: string }) {
  const response = await ctx.app.request('/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      app_id: ctx.appId,
      channel: 'production',
      checksum: `manifest-${input.version}`,
      external_url: `https://updates.example/${input.version}.zip`,
      manifest: input.manifest,
      platform: 'ios',
      version: input.version,
    }),
  }, ctx.env)
  expect(response.status).toBe(200)
  const release = await ctx.storage.getRelease(ctx.appId, 'ios', 'production', input.version)
  expect(release).toBeTruthy()
  return release!
}

async function postUpdate(ctx: Awaited<ReturnType<typeof seedManifestApp>>, pluginVersion: string, versionName = '1.0.0') {
  return await ctx.app.request('/updates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: ctx.appId,
      defaultChannel: 'production',
      device_id: 'device-manifest',
      platform: 'ios',
      plugin_version: pluginVersion,
      version_build: versionName,
      version_name: versionName,
    }),
  }, ctx.env)
}

describe('[Capgo parity] update manifest scenarios', () => {
  it('returns manifest entries for plugin versions that support manifest updates', async () => {
    const ctx = await seedManifestApp()
    await createRelease(ctx, { version: '2.0.0', manifest })

    const response = await postUpdate(ctx, '6.25.0')
    expect(response.status).toBe(200)
    const json = await response.json() as { manifest?: Array<{ file_name: string | null, download_url: string, file_hash?: string | null }> }

    expect(json.manifest).toBeDefined()
    expect(json.manifest?.[0]?.file_name).toBe('test')
    expect(json.manifest?.[0]?.download_url).toContain('/test_file.html')
    expect(json.manifest?.[0]?.file_hash).toBe('1234567890')
  })

  it('does not expose manifest entries to plugin versions below the manifest gate', async () => {
    const ctx = await seedManifestApp()
    await createRelease(ctx, { version: '2.0.0', manifest })

    const response = await postUpdate(ctx, '6.7.0')
    expect(response.status).toBe(200)
    const json = await response.json() as { manifest?: unknown }

    expect(json.manifest).toBeUndefined()
  })

  it('returns Cannot get bundle when a release has neither bundle path nor manifest', async () => {
    const ctx = await seedManifestApp()
    const release = await createRelease(ctx, { version: '2.0.0' })
    release.path = ''
    release.manifest = []

    const response = await postUpdate(ctx, '6.25.0')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ message: 'Cannot get bundle' })
  })

  it('returns manifest-only updates when the bundle path is missing but manifest entries exist', async () => {
    const ctx = await seedManifestApp()
    const release = await createRelease(ctx, { version: '2.0.0', manifest })
    release.path = ''

    const response = await postUpdate(ctx, '6.25.0')
    expect(response.status).toBe(200)
    const json = await response.json() as { manifest?: unknown[], url?: string }

    expect(json.manifest).toBeDefined()
    expect(json.url).toBeUndefined()
  })
})
