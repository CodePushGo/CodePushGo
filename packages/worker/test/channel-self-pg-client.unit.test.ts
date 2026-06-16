import { describe, expect, it, vi } from 'vitest'
import { readLegacyChannelSelfOverride, writeLegacyChannelSelfOverride } from '../src/channel-self-store'
import { authHeaders, testApp } from './helpers'

function createKvStore() {
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

describe('[Capgo parity] channel_self Worker storage routing', () => {
  it('uses KV for old plugin channel self storage when the store is bound', async () => {
    const kv = createKvStore()
    const wrote = await writeLegacyChannelSelfOverride(kv, {
      appId: 'com.test.app',
      deviceId: '11111111-1111-4111-8111-111111111111',
      channelName: 'beta',
      pluginVersion: '7.33.0',
    })

    const { storage } = testApp()
    const read = await readLegacyChannelSelfOverride(kv, storage, {
      appId: 'com.test.app',
      deviceId: '11111111-1111-4111-8111-111111111111',
      pluginVersion: '7.33.0',
    })

    expect(wrote).toBe(true)
    expect(kv.put).toHaveBeenCalled()
    expect(kv.get).toHaveBeenCalled()
    expect(read).toBe('beta')
  })

  it('resolves KV channel id through current channel metadata for old plugin reads', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.test.channel.self.pg.client'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)
    await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel: 'beta-current', public: true, allow_self_set: true }),
    }, env)
    const beta = (await storage.listChannels(appId)).find(channel => channel.name === 'beta-current')
    expect(beta).toBeTruthy()

    const kv = createKvStore()
    kv.values.set(`channel_self:v1:${appId}:device-1`, JSON.stringify({
      app_id: appId,
      device_id: 'device-1',
      channel_id: beta?.id,
      channel_name: 'stale-name',
      allow_device_self_set: false,
      updated_at: '2026-01-01T00:00:00.000Z',
    }))

    const read = await readLegacyChannelSelfOverride(kv, storage, {
      appId,
      deviceId: 'device-1',
      pluginVersion: '7.33.0',
    })

    expect(read).toBe('beta-current')
  })

  it('does not query KV for new plugin channel self storage when store is bound', async () => {
    const kv = createKvStore()

    const wrote = await writeLegacyChannelSelfOverride(kv, {
      appId: 'com.test.app',
      deviceId: 'device-1',
      channelName: 'beta',
      pluginVersion: '7.34.0',
    })
    const { storage } = testApp()
    const read = await readLegacyChannelSelfOverride(kv, storage, {
      appId: 'com.test.app',
      deviceId: 'device-1',
      pluginVersion: '7.34.0',
    })

    expect(wrote).toBe(false)
    expect(read).toBeUndefined()
    expect(kv.get).not.toHaveBeenCalled()
    expect(kv.put).not.toHaveBeenCalled()
  })
})
