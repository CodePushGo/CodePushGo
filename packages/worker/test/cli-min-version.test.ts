import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('tests min version', () => {
  it('stores min_update_version on uploaded bundles and returns it in bundle responses', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.cli.min.version.metadata'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)

    const upload = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: appId,
        version: '2.0.0',
        platform: 'ios',
        channel: 'production',
        external_url: 'https://cdn.example.com/min.zip',
        min_update_version: '1.5.0',
      }),
    }, env)

    expect(upload.status).toBe(200)
    await expect(upload.json()).resolves.toMatchObject({ bundle: { min_update_version: '1.5.0', minUpdateVersion: '1.5.0' } })
    expect((await storage.listReleases(appId))[0]).toMatchObject({ minUpdateVersion: '1.5.0' })
  })

  it('does not offer updates to clients below min_update_version', async () => {
    const { app, env } = testApp()
    const appId = 'com.cli.min.version.updates'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)
    await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: appId,
        version: '2.0.0',
        platform: 'ios',
        channel: 'production',
        external_url: 'https://cdn.example.com/min.zip',
        minUpdateVersion: '1.5.0',
      }),
    }, env)

    const tooOld = await app.request('https://api.test/updates', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId, platform: 'ios', version_name: '1.4.9', device_id: 'device-old' }),
    }, env)
    expect(tooOld.status).toBe(200)
    await expect(tooOld.json()).resolves.toMatchObject({ available: false, kind: 'up_to_date' })

    const eligible = await app.request('https://api.test/updates', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId, platform: 'ios', version_name: '1.5.0', device_id: 'device-new' }),
    }, env)
    expect(eligible.status).toBe(200)
    await expect(eligible.json()).resolves.toMatchObject({ available: true, version: '2.0.0' })
  })
})
