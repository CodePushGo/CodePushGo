import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] CLI upload backend contract', () => {
  it('links one uploaded bundle to multiple comma-separated channels', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.cli.multi.channel'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)
    await storage.upsertChannel({ appId, name: 'beta', public: false, allowSelfSet: true })

    const upload = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: appId,
        version: '1.2.3',
        platform: 'ios',
        channel: 'production,beta',
        external_url: 'https://cdn.example.com/bundle.zip',
      }),
    }, env)

    expect(upload.status).toBe(200)
    await expect(upload.json()).resolves.toMatchObject({
      status: 'success',
      bundle: { app_id: appId, version: '1.2.3', channel: 'production' },
      bundles: expect.arrayContaining([
        expect.objectContaining({ app_id: appId, version: '1.2.3', channel: 'production' }),
        expect.objectContaining({ app_id: appId, version: '1.2.3', channel: 'beta' }),
      ]),
    })

    const releases = await storage.listReleases(appId)
    expect(releases.map(release => release.channel).sort()).toEqual(['beta', 'production'])
  })

  it('rejects duplicate CLI upload only for the already linked target channel', async () => {
    const { app, env } = testApp()
    const appId = 'com.cli.duplicate.channel'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)
    await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, version: '2.0.0', platform: 'ios', channel: 'production', external_url: 'https://cdn.example.com/one.zip' }),
    }, env)

    const duplicate = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, version: '2.0.0', platform: 'ios', channel: 'production,beta', external_url: 'https://cdn.example.com/two.zip' }),
    }, env)

    expect(duplicate.status).toBe(400)
    await expect(duplicate.json()).resolves.toMatchObject({ error: 'version_already_exists' })
  })
})
