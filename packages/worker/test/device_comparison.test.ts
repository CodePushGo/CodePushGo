import type { DeviceExistingRowLike } from '../src/device-comparison'
import type { UpsertDeviceInput } from '../src/storage'
import { describe, expect, it } from 'vitest'
import {
  buildNormalizedDeviceForWrite,
  hasComparableDeviceChanged,
  nullableString,
  toComparableDevice,
  toComparableExisting,
} from '../src/device-comparison'

function simulateReplicaStorage(device: UpsertDeviceInput): DeviceExistingRowLike {
  const comparable = toComparableDevice(device)
  return {
    platform: comparable.platform,
    plugin_version: comparable.plugin_version,
    os_version: comparable.os_version,
    version_build: comparable.version_build,
    custom_id: comparable.custom_id,
    version_name: comparable.version_name,
    is_prod: comparable.is_prod ? 1 : 0,
    is_emulator: comparable.is_emulator ? 1 : 0,
    default_channel: comparable.default_channel,
    key_id: comparable.key_id,
  }
}

describe('[Capgo parity] deviceComparison utilities', () => {
  it('normalizes optional strings like Capgo replica comparisons', () => {
    expect(nullableString(undefined)).toBe(null)
    expect(nullableString(null)).toBe(null)
    expect(nullableString('')).toBe(null)
    expect(nullableString('test')).toBe('test')
    expect(nullableString('  ')).toBe('  ')
  })

  it('converts a complete device to comparable replica fields', () => {
    expect(toComparableDevice({
      appId: 'test-app',
      deviceId: 'test-device',
      platform: 'android',
      pluginVersion: '1.0.0',
      osVersion: '14',
      versionBuild: '100',
      customId: 'custom-123',
      versionName: 'v1.0.0',
      isProd: true,
      isEmulator: false,
      defaultChannel: 'production',
      keyId: 'encryption-key-1',
    })).toEqual({
      platform: 'android',
      plugin_version: '1.0.0',
      os_version: '14',
      version_build: '100',
      custom_id: 'custom-123',
      version_name: 'v1.0.0',
      is_prod: true,
      is_emulator: false,
      default_channel: 'production',
      key_id: 'encryption-key-1',
    })
  })

  it('applies replica defaults for empty and missing fields', () => {
    expect(toComparableDevice({
      appId: 'test-app',
      deviceId: 'test-device',
      platform: 'ios',
      pluginVersion: '',
      osVersion: '',
      versionBuild: '',
      customId: '',
      versionName: '',
      isProd: false,
      isEmulator: false,
      defaultChannel: '',
      keyId: '',
    })).toEqual({
      platform: 'ios',
      plugin_version: '',
      os_version: '',
      version_build: 'builtin',
      custom_id: '',
      version_name: null,
      is_prod: false,
      is_emulator: false,
      default_channel: null,
      key_id: null,
    })
  })

  it('converts existing database rows including numeric booleans', () => {
    expect(toComparableExisting({
      platform: 'ios',
      plugin_version: '2.0.0',
      os_version: '17',
      version_build: '200',
      custom_id: 'db-custom',
      version_name: 'v2.0.0',
      is_prod: 1,
      is_emulator: 0,
      default_channel: 'beta',
      key_id: 'db-key',
    })).toEqual({
      platform: 'ios',
      plugin_version: '2.0.0',
      os_version: '17',
      version_build: '200',
      custom_id: 'db-custom',
      version_name: 'v2.0.0',
      is_prod: true,
      is_emulator: false,
      default_channel: 'beta',
      key_id: 'db-key',
    })
  })

  it('uses replica defaults for missing existing rows', () => {
    expect(toComparableExisting(null)).toEqual({
      platform: null,
      plugin_version: '',
      os_version: '',
      version_build: 'builtin',
      custom_id: '',
      version_name: null,
      is_prod: false,
      is_emulator: false,
      default_channel: null,
      key_id: null,
    })
    expect(toComparableExisting(undefined)).toEqual(toComparableExisting(null))
  })

  it('does not detect a change after a replica write/read cycle', () => {
    const device: UpsertDeviceInput = {
      appId: 'test-app',
      deviceId: 'test-device',
      platform: 'android',
      pluginVersion: null as unknown as string,
      osVersion: undefined,
      versionBuild: undefined,
      customId: null as unknown as string,
      versionName: '',
      isProd: false,
      isEmulator: false,
      defaultChannel: null as unknown as string,
      keyId: undefined,
    }

    expect(hasComparableDeviceChanged(simulateReplicaStorage(device), device)).toBe(false)
  })

  it('detects every field that should trigger a device rewrite', () => {
    const existing: DeviceExistingRowLike = {
      platform: 'android',
      plugin_version: '1.0.0',
      os_version: '14',
      version_build: '100',
      custom_id: 'custom-123',
      version_name: 'v1.0.0',
      is_prod: false,
      is_emulator: false,
      default_channel: 'production',
      key_id: 'key-v1',
    }

    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), pluginVersion: '2.0.0' })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), osVersion: '15' })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), versionBuild: '101' })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), customId: 'custom-456' })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), versionName: 'v2.0.0' })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), isProd: true })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), isEmulator: true })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), defaultChannel: 'development' })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), keyId: 'key-v2' })).toBe(true)
    expect(hasComparableDeviceChanged(existing, { appId: 'app', deviceId: 'dev', ...camel(existing), platform: 'ios' })).toBe(true)
  })

  it('normalizes key_id for backward compatibility and detects rotations', () => {
    expect(toComparableDevice({ appId: 'app', deviceId: 'dev', keyId: '' }).key_id).toBe(null)
    expect(toComparableDevice({ appId: 'app', deviceId: 'dev', keyId: undefined }).key_id).toBe(null)
    expect(hasComparableDeviceChanged({ key_id: null }, { appId: 'app', deviceId: 'dev', keyId: '' })).toBe(false)
    expect(hasComparableDeviceChanged({ key_id: 'old-key' }, { appId: 'app', deviceId: 'dev', keyId: 'new-key' })).toBe(true)
  })

  it('builds normalized write payloads with database column names', () => {
    expect(buildNormalizedDeviceForWrite({
      appId: 'app',
      deviceId: 'dev',
      platform: 'android',
      pluginVersion: '7.0.0',
      osVersion: '14',
      keyId: 'write-key',
    })).toEqual({
      platform: 'android',
      plugin_version: '7.0.0',
      os_version: '14',
      version_build: 'builtin',
      custom_id: '',
      version_name: null,
      is_prod: false,
      is_emulator: false,
      default_channel: null,
      key_id: 'write-key',
    })
  })
})

function camel(existing: DeviceExistingRowLike): UpsertDeviceInput {
  return {
    appId: 'app',
    deviceId: 'dev',
    platform: existing.platform ?? undefined,
    pluginVersion: existing.plugin_version ?? undefined,
    osVersion: existing.os_version ?? undefined,
    versionBuild: existing.version_build ?? undefined,
    customId: existing.custom_id ?? undefined,
    versionName: existing.version_name ?? undefined,
    isProd: existing.is_prod === true || existing.is_prod === 1,
    isEmulator: existing.is_emulator === true || existing.is_emulator === 1,
    defaultChannel: existing.default_channel ?? undefined,
    keyId: existing.key_id ?? undefined,
  }
}
