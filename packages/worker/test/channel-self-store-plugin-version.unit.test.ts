import { describe, expect, it, vi } from 'vitest'
import { channelSelfStoreKey, deleteLegacyChannelSelfOverride, shouldDeleteChannelSelfOverrideForPluginVersion, shouldSyncChannelSelfOverrideForPluginVersion, writeLegacyChannelSelfOverride } from '../src/channel-self-store'

function createStore() {
  return {
    delete: vi.fn(async (_key: string) => undefined),
    put: vi.fn(async (_key: string, _value: string) => undefined),
    get: vi.fn(async () => null),
  }
}

const pluginVersionCases: [string | null, boolean][] = [
  ['5.33.9', true],
  ['5.34.0', false],
  ['6.33.9', true],
  ['6.34.0', false],
  ['7.33.9', true],
  ['7.34.0', false],
  ['7.42.0', false],
  ['8.0.0', false],
  ['0.0.0', true],
  ['', false],
  [null, false],
  ['invalid', false],
]

describe('[Capgo parity] channel_self override KV plugin version gate', () => {
  pluginVersionCases.forEach(([pluginVersion, expected]) => {
    it.concurrent(`returns ${expected} for ${pluginVersion ?? 'null'}`, () => {
      expect(shouldSyncChannelSelfOverrideForPluginVersion(pluginVersion)).toBe(expected)
    })
  })

  it.concurrent('writes channel_self KV for legacy plugin devices', async () => {
    const store = createStore()

    await writeLegacyChannelSelfOverride(store, {
      appId: 'com.test.app',
      channelName: 'beta',
      deviceId: 'DEVICE-ID',
      pluginVersion: '7.33.9',
    })

    expect(store.put).toHaveBeenCalledTimes(1)
    expect(store.put.mock.calls[0]?.[0]).toBe('channel_self:v1:com.test.app:device-id')
    expect(JSON.parse(store.put.mock.calls[0]?.[1] as string)).toMatchObject({
      app_id: 'com.test.app',
      channel_name: 'beta',
      device_id: 'device-id',
    })
  })

  it.concurrent('does not write channel_self KV for new plugin devices', async () => {
    const store = createStore()

    await writeLegacyChannelSelfOverride(store, {
      appId: 'com.test.app',
      channelName: 'beta',
      deviceId: 'DEVICE-ID',
      pluginVersion: '7.34.0',
    })

    expect(store.put).not.toHaveBeenCalled()
  })

  it.concurrent('deletes channel_self KV for legacy, missing, and unparsable plugin devices', async () => {
    expect(shouldDeleteChannelSelfOverrideForPluginVersion('7.33.9')).toBe(true)
    expect(shouldDeleteChannelSelfOverrideForPluginVersion(null)).toBe(true)
    expect(shouldDeleteChannelSelfOverrideForPluginVersion('invalid')).toBe(true)

    const store = createStore()
    await deleteLegacyChannelSelfOverride(store, { appId: 'com.test.app', deviceId: 'DEVICE-ID', pluginVersion: null })
    expect(store.delete).toHaveBeenCalledWith(channelSelfStoreKey('com.test.app', 'DEVICE-ID'))
  })

  it.concurrent('does not delete channel_self KV for new plugin devices', async () => {
    const store = createStore()

    await deleteLegacyChannelSelfOverride(store, { appId: 'com.test.app', deviceId: 'DEVICE-ID', pluginVersion: '7.42.0' })

    expect(store.delete).not.toHaveBeenCalled()
  })
})
