import type { StorageDriver } from './storage'

export interface ChannelSelfStore {
  get(key: string, options?: { type?: 'json' | 'text' }): Promise<unknown>
  put(key: string, value: string): Promise<unknown>
  delete(key: string): Promise<unknown>
}

export interface ChannelSelfOverridePayload {
  app_id: string
  device_id: string
  channel_name?: string
  channel_id?: number | string
  updated_at: string
}

export function channelSelfStoreKey(appId: string, deviceId: string) {
  return `channel_self:v1:${appId}:${deviceId.toLowerCase()}`
}

function parseVersion(pluginVersion: string | null | undefined) {
  if (!pluginVersion)
    return undefined
  const match = pluginVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match)
    return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

export function shouldSyncChannelSelfOverrideForPluginVersion(pluginVersion: string | null | undefined) {
  const parsed = parseVersion(pluginVersion)
  if (!parsed)
    return false
  if (parsed.major === 0 && parsed.minor === 0 && parsed.patch === 0)
    return true
  if (parsed.major < 5 || parsed.major > 7)
    return false
  return parsed.minor < 34
}

export function shouldDeleteChannelSelfOverrideForPluginVersion(pluginVersion: string | null | undefined) {
  if (pluginVersion === null || pluginVersion === undefined)
    return true
  const parsed = parseVersion(pluginVersion)
  if (!parsed)
    return true
  return shouldSyncChannelSelfOverrideForPluginVersion(pluginVersion)
}

export async function writeLegacyChannelSelfOverride(store: ChannelSelfStore | undefined, input: { appId: string, deviceId: string, channelName: string, pluginVersion?: string | null }) {
  if (!store || !shouldSyncChannelSelfOverrideForPluginVersion(input.pluginVersion))
    return false
  const payload: ChannelSelfOverridePayload = {
    app_id: input.appId,
    device_id: input.deviceId.toLowerCase(),
    channel_name: input.channelName,
    updated_at: new Date().toISOString(),
  }
  await store.put(channelSelfStoreKey(input.appId, input.deviceId), JSON.stringify(payload))
  return true
}

export async function readLegacyChannelSelfOverride(store: ChannelSelfStore | undefined, storage: StorageDriver, input: { appId: string, deviceId: string, pluginVersion?: string | null }) {
  if (!store || !shouldSyncChannelSelfOverrideForPluginVersion(input.pluginVersion))
    return undefined
  const value = await store.get(channelSelfStoreKey(input.appId, input.deviceId), { type: 'json' })
  if (!value || typeof value !== 'object')
    return undefined
  const payload = value as Partial<ChannelSelfOverridePayload>
  if (payload.channel_id != null) {
    const channels = await storage.listChannels(input.appId)
    const byId = channels.find(channel => channel.id === String(payload.channel_id) || channel.name === String(payload.channel_id))
    if (byId)
      return byId.name
  }
  if (typeof payload.channel_name === 'string')
    return payload.channel_name
  return undefined
}

export async function deleteLegacyChannelSelfOverride(store: ChannelSelfStore | undefined, input: { appId: string, deviceId: string, pluginVersion?: string | null }) {
  if (!store || !shouldDeleteChannelSelfOverrideForPluginVersion(input.pluginVersion))
    return false
  await store.delete(channelSelfStoreKey(input.appId, input.deviceId))
  return true
}
