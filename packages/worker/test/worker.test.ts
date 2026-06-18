import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
  return { app, env, storage }
}

const authHeaders = {
  authorization: 'Bearer test-token',
}

describe('CodePushGo worker', () => {
  it('requires bearer auth for admin endpoints', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/v1/apps', {}, env)
    expect(response.status).toBe(401)
  })

  it('requires Supabase service-role config for public signup', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123', first_name: 'Ada', last_name: 'Lovelace' }),
    }, env)

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: 'supabase_not_configured' })
  })

  it('uses in-memory storage for local Worker dev without D1/R2 bindings', async () => {
    const app = createWorkerApp()
    const env = { CODEPUSHGO_API_KEY: 'test-token', CODEPUSHGO_ENV: 'dev' } as Env

    const createResponse = await app.request('https://api.test/v1/apps', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ bundle_id: 'com.example.localdev', name: 'Local Dev' }),
    }, env)
    expect(createResponse.status).toBe(201)
    expect(await createResponse.json()).toMatchObject({ app_id: 'com.example.localdev', bundle_id: 'com.example.localdev' })

    const listResponse = await app.request('https://api.test/v1/apps', { headers: authHeaders }, env)
    expect(await listResponse.json()).toMatchObject({
      status: 'ok',
      apps: expect.arrayContaining([expect.objectContaining({ bundle_id: 'com.example.localdev' })]),
    })
  })

  it('creates an app, uploads a release, and serves update metadata', async () => {
    const { app, env } = testApp()

    const createResponse = await app.request('https://api.test/v1/apps', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ appId: 'com.example.app', name: 'Example' }),
    }, env)
    expect(createResponse.status).toBe(201)

    const bundleBytes = new TextEncoder().encode('bundle-data')
    const uploadResponse = await app.request('https://api.test/v1/apps/com.example.app/bundles', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/zip',
        'x-codepushgo-version': '1.0.1',
        'x-codepushgo-platform': 'ios',
        'x-codepushgo-channel': 'production',
        'x-codepushgo-checksum': 'abc123',
      },
      body: bundleBytes,
    }, env)
    expect(uploadResponse.status).toBe(201)

    const updateResponse = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app_id: 'com.example.app',
        device_id: 'device-1',
        platform: 'ios',
        version_name: '1.0.0',
      }),
    }, env)
    expect(updateResponse.status).toBe(200)
    const updateBody = await updateResponse.json()
    expect(updateBody).toMatchObject({ available: true, version: '1.0.1', checksum: 'abc123' })
    expect(updateBody.url).toBe('https://api.test/v1/apps/com.example.app/bundles/1.0.1/download?platform=ios&channel=production')

    const downloadResponse = await app.request(updateBody.url, {}, env)
    expect(downloadResponse.status).toBe(200)
    expect(await downloadResponse.text()).toBe('bundle-data')
  })

  it('returns no update when the device already has the latest version', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/v1/apps/com.example.app/bundles', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-codepushgo-version': '1.0.1',
        'x-codepushgo-platform': 'android',
      },
      body: new TextEncoder().encode('bundle-data'),
    }, env)

    const response = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app_id: 'com.example.app',
        device_id: 'device-1',
        platform: 'android',
        version_name: '1.0.1',
      }),
    }, env)

    expect(await response.json()).toMatchObject({ available: false, error: 'no_new_version_available', kind: 'up_to_date' })
  })

  it('records public stats events', async () => {
    const { app, env, storage } = testApp()
    await storage.createApp('com.example.app', 'Example')

    const response = await app.request('https://api.test/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app_id: 'com.example.app',
        device_id: 'device-1',
        platform: 'ios',
        version_name: '1.0.0',
        action: 'app_ready',
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(storage.stats).toHaveLength(1)
    expect(storage.stats[0]?.action).toBe('app_ready')
  })

  it('accepts bundle_id as the React Native app identity alias', async () => {
    const { app, env, storage } = testApp()
    await storage.createRelease({
      appId: 'com.example.alias',
      version: '1.0.1',
      platform: 'ios',
      channel: 'production',
      bytes: new TextEncoder().encode('bundle').buffer,
      checksum: 'abc123',
      size: 6,
      mandatory: false,
      rollout: 100,
    })

    const response = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bundle_id: 'com.example.alias',
        device_id: 'device-1',
        platform: 'ios',
        version_name: '1.0.0',
      }),
    }, env)

    expect(await response.json()).toMatchObject({ available: true, version: '1.0.1' })
  })

  it('uses channel_self device overrides before falling back to the default channel', async () => {
    const { app, env, storage } = testApp()
    const bytes = new TextEncoder().encode('bundle')
    await storage.createRelease({
      appId: 'com.example.self',
      version: '1.0.1',
      platform: 'android',
      channel: 'production',
      bytes: bytes.buffer,
      checksum: 'prod-checksum',
      size: bytes.byteLength,
      mandatory: false,
      rollout: 100,
    })
    await storage.createRelease({
      appId: 'com.example.self',
      version: '2.0.0',
      platform: 'android',
      channel: 'beta',
      bytes: bytes.buffer,
      checksum: 'beta-checksum',
      size: bytes.byteLength,
      mandatory: true,
      rollout: 100,
    })

    const channelsResponse = await app.request('https://api.test/channel_self?bundle_id=com.example.self&platform=android', {
      method: 'GET',
    }, env)
    expect(await channelsResponse.json()).toEqual([
      { id: 'beta', name: 'beta', public: false, allow_self_set: true, allowSelfSet: true },
      { id: 'production', name: 'production', public: true, allow_self_set: true, allowSelfSet: true },
    ])

    const setResponse = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bundle_id: 'com.example.self',
        device_id: 'device-1',
        platform: 'android',
        channel: 'beta',
      }),
    }, env)
    expect(await setResponse.json()).toEqual({ status: 'ok', channel: 'beta' })

    const overrideResponse = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bundle_id: 'com.example.self',
        device_id: 'device-1',
        platform: 'android',
        version_name: '1.0.0',
        defaultChannel: 'production',
      }),
    }, env)
    expect(await overrideResponse.json()).toMatchObject({ available: true, channel: 'beta', version: '2.0.0' })

    const readResponse = await app.request('https://api.test/channel_self', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bundle_id: 'com.example.self',
        device_id: 'device-1',
        defaultChannel: 'production',
      }),
    }, env)
    expect(await readResponse.json()).toEqual({ status: 'override', channel: 'beta' })

    const clearResponse = await app.request('https://api.test/channel_self?bundle_id=com.example.self&device_id=device-1', {
      method: 'DELETE',
    }, env)
    expect(await clearResponse.json()).toEqual({ status: 'ok' })

    const defaultResponse = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bundle_id: 'com.example.self',
        device_id: 'device-1',
        platform: 'android',
        version_name: '1.0.0',
        defaultChannel: 'production',
      }),
    }, env)
    expect(await defaultResponse.json()).toMatchObject({ available: true, channel: 'production', version: '1.0.1' })
  })
})
