import { describe, expect, it, vi } from 'vitest'
import { authHeaders, testApp } from './helpers'

const appId = 'com.test.device.override.kv'

function createStore() {
  const values = new Map<string, string>()
  return {
    values,
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const value = values.get(key)
      if (!value)
        return null
      return options?.type === 'json' ? JSON.parse(value) : value
    }),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key)
    }),
  }
}

async function seed() {
  const ctx = testApp()
  await ctx.app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  await ctx.storage.upsertChannel({ appId, name: 'beta', public: true, allowSelfSet: true })
  return ctx
}

describe('[Capgo parity] channel device override KV sync', () => {
  it('syncs public device API channel override writes through the legacy channel_self helper', async () => {
    const { app, env, storage } = await seed()
    const store = createStore()

    const response = await app.request('https://api.test/device', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel: 'beta', device_id: 'DEVICE-ID', plugin_version: '7.33.9' }),
    }, { ...env, CHANNEL_SELF_STORE: store })

    expect(response.status).toBe(200)
    expect(await storage.getDeviceChannel(appId, 'DEVICE-ID')).toBe('beta')
    expect(store.put).toHaveBeenCalledWith('channel_self:v1:com.test.device.override.kv:device-id', expect.any(String))
  })

  it('syncs public device API channel override deletes through the legacy channel_self helper', async () => {
    const { app, env, storage } = await seed()
    const store = createStore()
    await storage.upsertDevice({ appId, deviceId: 'DEVICE-ID', pluginVersion: '7.33.9', channel: 'beta' })

    const response = await app.request('https://api.test/device', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, device_id: 'DEVICE-ID' }),
    }, { ...env, CHANNEL_SELF_STORE: store })

    expect(response.status).toBe(200)
    expect(store.delete).toHaveBeenCalledWith('channel_self:v1:com.test.device.override.kv:device-id')
  })

  it('uses KV for old plugin channel_self writes when the store is bound', async () => {
    const { app, env, storage } = await seed()
    const store = createStore()

    const response = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, channel: 'beta', device_id: 'DEVICE-ID', plugin_version: '7.33.9' }),
    }, { ...env, CHANNEL_SELF_STORE: store })

    expect(response.status).toBe(200)
    expect(store.put).toHaveBeenCalled()
    expect(await storage.getDeviceChannel(appId, 'DEVICE-ID')).toBeUndefined()
  })

  it('does not query KV for new plugin channel self storage when store is bound', async () => {
    const { app, env } = await seed()
    const store = createStore()

    const response = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, channel: 'beta', device_id: 'DEVICE-ID', plugin_version: '7.34.0' }),
    }, { ...env, CHANNEL_SELF_STORE: store })

    expect(response.status).toBe(200)
    expect(store.put).not.toHaveBeenCalled()
  })
})
