import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const authHeaders = { authorization: 'Bearer test-token' }

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
  return { app, env, storage }
}

describe('app_id validation', () => {
  it('rejects app creation with invalid app ids', async () => {
    const { app, env } = testApp()
    for (const appId of ['invalid-app-id', 'justappname', '.com.example.app', 'com.example.app+special', '[appid]']) {
      const response = await app.request('https://api.test/v1/apps', {
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ appId, name: 'Invalid' }),
      }, env)
      expect(response.status, appId).toBe(400)
      expect(await response.json(), appId).toMatchObject({ error: 'invalid_app_id' })
    }
  })

  it('accepts Capgo-style app_id payloads for valid reverse-domain ids', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/v1/apps', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: 'com.test.valid', name: 'Valid' }),
    }, env)

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ app_id: 'com.test.valid' })
  })


  it('accepts bundle_id as the React Native identity on admin endpoints', async () => {
    const { app, env } = testApp()
    const create = await app.request('https://api.test/v1/apps', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ bundle_id: 'com.test.bundleid', name: 'Bundle ID App' }),
    }, env)
    expect(create.status).toBe(201)
    expect(await create.json()).toMatchObject({ app_id: 'com.test.bundleid', bundle_id: 'com.test.bundleid' })

    const channel = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ bundle_id: 'com.test.bundleid', channel: 'beta' }),
    }, env)
    expect(channel.status).toBe(200)
    expect(await channel.json()).toMatchObject({ status: 'ok', channel: { name: 'beta' } })

    const device = await app.request('https://api.test/device', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ bundle_id: 'com.test.bundleid', device_id: 'device-1', channel: 'beta' }),
    }, env)
    expect(device.status).toBe(200)
    expect(await device.json()).toMatchObject({ status: 'ok', device: { app_id: 'com.test.bundleid', bundle_id: 'com.test.bundleid' } })

    const read = await app.request('https://api.test/device?bundle_id=com.test.bundleid&device_id=device-1', {
      headers: authHeaders,
    }, env)
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ app_id: 'com.test.bundleid', bundle_id: 'com.test.bundleid' })
  })
  it('rejects invalid app ids in bundle, update, stats, and channel_self requests', async () => {
    const { app, env } = testApp()

    const bundleResponse = await app.request('https://api.test/v1/apps/invalid-app/bundles', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-codepushgo-version': '1.0.0',
        'x-codepushgo-platform': 'ios',
      },
      body: new TextEncoder().encode('bundle'),
    }, env)
    expect(await bundleResponse.json()).toMatchObject({ error: 'invalid_app_id' })

    const updateResponse = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: 'badid', device_id: 'device-1', platform: 'ios', version_name: '1.0.0' }),
    }, env)
    expect(updateResponse.status).toBe(400)
    expect(await updateResponse.json()).toMatchObject({ error: 'invalid_app_id' })

    const statsResponse = await app.request('https://api.test/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: 'badid', device_id: 'device-1', platform: 'ios', version_name: '1.0.0', action: 'app_ready' }),
    }, env)
    expect(statsResponse.status).toBe(400)
    expect(await statsResponse.json()).toMatchObject({ error: 'invalid_app_id' })

    const channelResponse = await app.request('https://api.test/channel_self?app_id=badid&platform=ios', {
      method: 'GET',
    }, env)
    expect(channelResponse.status).toBe(400)
    expect(await channelResponse.json()).toMatchObject({ error: 'invalid_app_id' })
  })
})
