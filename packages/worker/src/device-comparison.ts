import type { DeviceRecord, Platform } from '@codepushgo/shared'
import type { UpsertDeviceInput } from './storage'

type MaybeString = string | null | undefined

type MaybeBoolean = boolean | number | null | undefined

export interface DeviceExistingRowLike {
  platform?: Platform | null
  plugin_version?: MaybeString
  pluginVersion?: MaybeString
  os_version?: MaybeString
  osVersion?: MaybeString
  version_build?: MaybeString
  versionBuild?: MaybeString
  custom_id?: MaybeString
  customId?: MaybeString
  version_name?: MaybeString
  versionName?: MaybeString
  is_prod?: MaybeBoolean
  isProd?: MaybeBoolean
  is_emulator?: MaybeBoolean
  isEmulator?: MaybeBoolean
  default_channel?: MaybeString
  defaultChannel?: MaybeString
  key_id?: MaybeString
  keyId?: MaybeString
}

export interface ComparableDevice {
  platform: Platform | null
  plugin_version: string
  os_version: string
  version_build: string
  custom_id: string
  version_name: string | null
  is_prod: boolean
  is_emulator: boolean
  default_channel: string | null
  key_id: string | null
}

export interface NormalizedDeviceForWrite {
  platform: Platform | null
  plugin_version: string
  os_version: string
  version_build: string
  custom_id: string
  version_name: string | null
  is_prod: boolean
  is_emulator: boolean
  default_channel: string | null
  key_id: string | null
}

export type DeviceForComparison = Partial<UpsertDeviceInput & DeviceRecord & DeviceExistingRowLike>

export function nullableString(value: MaybeString) {
  return value === undefined || value === null || value === '' ? null : value
}

function stringWithDefault(value: MaybeString, fallback: string) {
  return nullableString(value) ?? fallback
}

function booleanWithDefault(value: MaybeBoolean) {
  if (typeof value === 'number')
    return value === 1
  return value ?? false
}

function getMaybeString(input: DeviceForComparison, camelKey: keyof DeviceForComparison, snakeKey: keyof DeviceForComparison) {
  return (input[camelKey] ?? input[snakeKey]) as MaybeString
}

function getMaybeBoolean(input: DeviceForComparison, camelKey: keyof DeviceForComparison, snakeKey: keyof DeviceForComparison) {
  return (input[camelKey] ?? input[snakeKey]) as MaybeBoolean
}

function toComparable(input: DeviceForComparison | null | undefined): ComparableDevice {
  const device = input ?? {}
  return {
    platform: (device.platform ?? null) as Platform | null,
    plugin_version: stringWithDefault(getMaybeString(device, 'pluginVersion', 'plugin_version'), ''),
    os_version: stringWithDefault(getMaybeString(device, 'osVersion', 'os_version'), ''),
    version_build: stringWithDefault(getMaybeString(device, 'versionBuild', 'version_build'), 'builtin'),
    custom_id: stringWithDefault(getMaybeString(device, 'customId', 'custom_id'), ''),
    version_name: nullableString(getMaybeString(device, 'versionName', 'version_name')),
    is_prod: booleanWithDefault(getMaybeBoolean(device, 'isProd', 'is_prod')),
    is_emulator: booleanWithDefault(getMaybeBoolean(device, 'isEmulator', 'is_emulator')),
    default_channel: nullableString(getMaybeString(device, 'defaultChannel', 'default_channel')),
    key_id: nullableString(getMaybeString(device, 'keyId', 'key_id')),
  }
}

export function toComparableDevice(device: DeviceForComparison): ComparableDevice {
  return toComparable(device)
}

export function toComparableExisting(existing: DeviceForComparison | null | undefined): ComparableDevice {
  return toComparable(existing)
}

export function hasComparableDeviceChanged(existing: DeviceForComparison | null | undefined, device: DeviceForComparison) {
  const left = toComparableExisting(existing)
  const right = toComparableDevice(device)
  return Object.keys(left).some((key) => left[key as keyof ComparableDevice] !== right[key as keyof ComparableDevice])
}

export function buildNormalizedDeviceForWrite(device: DeviceForComparison): NormalizedDeviceForWrite {
  return { ...toComparableDevice(device) }
}
