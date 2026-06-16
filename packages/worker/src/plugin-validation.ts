import type { Platform } from '@codepushgo/shared'
import { isValidAppId, isValidReleaseVersion } from '@codepushgo/shared'

export const MISSING_STRING_APP_ID = 'App ID is required'
export const NON_STRING_APP_ID = 'App ID must be a string'
export const INVALID_STRING_APP_ID = 'App ID must be a reverse domain string'
export const MISSING_STRING_DEVICE_ID = 'Device ID is required'
export const NON_STRING_DEVICE_ID = 'Device ID must be a string'
export const INVALID_STRING_DEVICE_ID = 'Device ID must be a valid UUID string'
export const MISSING_STRING_VERSION_NAME = 'Version name is required'
export const NON_STRING_VERSION_NAME = 'Version name must be a string'
export const MISSING_STRING_VERSION_BUILD = 'Version build is required'
export const NON_STRING_VERSION_BUILD = 'Version build must be a string'
export const MISSING_STRING_VERSION_OS = 'Version OS is required'
export const NON_STRING_VERSION_OS = 'Version OS must be a string'
export const MISSING_STRING_PLATFORM = 'Platform is required'
export const NON_STRING_PLATFORM = 'Platform must be a string'
export const INVALID_STRING_PLATFORM = 'Platform is not supported or invalid'
export const MISSING_STRING_PLUGIN_VERSION = 'plugin_version is required'
export const INVALID_STRING_PLUGIN_VERSION = 'Plugin version is invalid'

export interface ValidationIssue {
  message: string
  path: PropertyKey[]
}

export interface StandardSchema<T> {
  '~standard': {
    validate: (value: unknown) => { value: T } | { issues: ValidationIssue[] }
  }
}

interface UnknownRecord {
  [key: string]: unknown
}

export type UpdatePluginRequest = UnknownRecord & {
  app_id: string
  device_id: string
  platform: Platform
  version_name: string
  version_build: string
  plugin_version: string
  is_prod: boolean
  is_emulator: boolean
}

export type StatsPluginRequest = UnknownRecord & {
  app_id: string
  device_id: string
  platform: Platform
  version_name: string
  version_os: string
  is_prod: boolean
  is_emulator: boolean
}

export type ChannelSelfPluginRequest = UpdatePluginRequest

const deviceIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const statsActions = new Set(['app_ready', 'download_start', 'download_complete', 'download_fail', 'install_start', 'install_complete', 'install_fail', 'rollback'])
const maxStatsMetadataFields = 30
const maxStatsMetadataKeyLength = 64
const maxStatsMetadataValueLength = 2048

export class SchemaError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map(issue => issue.message).join('; ') || 'Schema validation failed')
    this.name = 'SchemaError'
  }
}

export function safeParseSchema<T>(schema: StandardSchema<T>, value: unknown): { success: true, data: T } | { success: false, error: SchemaError } {
  const result = schema['~standard'].validate(value)
  if ('issues' in result)
    return { success: false, error: new SchemaError(result.issues) }
  return { success: true, data: result.value }
}

function issue(path: string, message: string): ValidationIssue {
  return { path: [path], message }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(input: UnknownRecord, key: string, issues: ValidationIssue[], missing: string, nonString: string) {
  const value = input[key]
  if (value === undefined) {
    issues.push(issue(key, missing))
    return undefined
  }
  if (typeof value !== 'string') {
    issues.push(issue(key, nonString))
    return undefined
  }
  return value
}

function optionalString(input: UnknownRecord, key: string, issues: ValidationIssue[], maxLength?: number) {
  const value = input[key]
  if (value === undefined)
    return undefined
  if (typeof value !== 'string') {
    issues.push(issue(key, `${key} must be a string`))
    return undefined
  }
  if (maxLength !== undefined && value.length > maxLength) {
    issues.push(issue(key, `String must contain at most ${maxLength} character(s)`))
    return undefined
  }
  return value
}

function requiredBoolean(input: UnknownRecord, key: string, issues: ValidationIssue[]) {
  if (typeof input[key] !== 'boolean')
    issues.push(issue(key, `${key} must be a boolean`))
}

function appId(input: UnknownRecord, issues: ValidationIssue[]) {
  const value = requiredString(input, 'app_id', issues, MISSING_STRING_APP_ID, NON_STRING_APP_ID)
  if (value !== undefined && !isValidAppId(value))
    issues.push(issue('app_id', INVALID_STRING_APP_ID))
}

function deviceId(input: UnknownRecord, issues: ValidationIssue[]) {
  const value = requiredString(input, 'device_id', issues, MISSING_STRING_DEVICE_ID, NON_STRING_DEVICE_ID)
  if (value === undefined)
    return
  if (value.length > 36) {
    issues.push(issue('device_id', 'String must contain at most 36 character(s)'))
    return
  }
  if (!deviceIdRegex.test(value))
    issues.push(issue('device_id', INVALID_STRING_DEVICE_ID))
}

function versionName(input: UnknownRecord, issues: ValidationIssue[], allowEmpty = false) {
  const value = requiredString(input, 'version_name', issues, MISSING_STRING_VERSION_NAME, NON_STRING_VERSION_NAME)
  if (value !== undefined && !allowEmpty && value.length === 0)
    issues.push(issue('version_name', MISSING_STRING_VERSION_NAME))
}

function versionBuild(input: UnknownRecord, issues: ValidationIssue[], allowEmpty = false) {
  const value = requiredString(input, 'version_build', issues, MISSING_STRING_VERSION_BUILD, NON_STRING_VERSION_BUILD)
  if (value !== undefined && !allowEmpty && value.length === 0)
    issues.push(issue('version_build', MISSING_STRING_VERSION_BUILD))
}

function versionOs(input: UnknownRecord, issues: ValidationIssue[]) {
  requiredString(input, 'version_os', issues, MISSING_STRING_VERSION_OS, NON_STRING_VERSION_OS)
}

function platform(input: UnknownRecord, issues: ValidationIssue[], strictTypeMessage: boolean) {
  const value = input.platform
  if (value === undefined) {
    issues.push(issue('platform', MISSING_STRING_PLATFORM))
    return
  }
  if (typeof value !== 'string') {
    issues.push(issue('platform', strictTypeMessage ? NON_STRING_PLATFORM : INVALID_STRING_PLATFORM))
    return
  }
  if (value !== 'ios' && value !== 'android')
    issues.push(issue('platform', INVALID_STRING_PLATFORM))
}

function pluginVersion(input: UnknownRecord, issues: ValidationIssue[]) {
  const value = input.plugin_version
  if (value === undefined) {
    issues.push(issue('plugin_version', MISSING_STRING_PLUGIN_VERSION))
    return
  }
  if (typeof value !== 'string' || !isValidReleaseVersion(value))
    issues.push(issue('plugin_version', INVALID_STRING_PLUGIN_VERSION))
}

function baseBooleans(input: UnknownRecord, issues: ValidationIssue[]) {
  requiredBoolean(input, 'is_emulator', issues)
  requiredBoolean(input, 'is_prod', issues)
}

function statsMetadata(input: UnknownRecord, issues: ValidationIssue[]) {
  const metadata = input.metadata
  if (metadata === undefined)
    return
  if (!isRecord(metadata)) {
    issues.push(issue('metadata', 'metadata must be an object with string values'))
    return
  }
  const entries = Object.entries(metadata)
  if (entries.length > maxStatsMetadataFields) {
    issues.push(issue('metadata', `metadata must contain at most ${maxStatsMetadataFields} fields`))
    return
  }
  for (const [key, value] of entries) {
    if (key.length > maxStatsMetadataKeyLength)
      issues.push(issue(`metadata.${key}`, `metadata keys must contain at most ${maxStatsMetadataKeyLength} characters`))
    if (typeof value !== 'string')
      issues.push(issue(`metadata.${key}`, 'metadata values must be strings'))
    else if (value.length > maxStatsMetadataValueLength)
      issues.push(issue(`metadata.${key}`, `metadata values must contain at most ${maxStatsMetadataValueLength} characters`))
  }
}

function optionalAction(input: UnknownRecord, issues: ValidationIssue[]) {
  const value = input.action
  if (value === undefined)
    return
  if (typeof value !== 'string') {
    issues.push(issue('action', 'action must be a string'))
    return
  }
  if (!statsActions.has(value))
    issues.push(issue('action', `action must be one of: ${[...statsActions].join(', ')}`))
}

function createSchema<T>(validate: (input: UnknownRecord, issues: ValidationIssue[]) => void): StandardSchema<T> {
  return {
    '~standard': {
      validate(value) {
        if (!isRecord(value))
          return { issues: [issue('', 'Expected object')] }
        const issues: ValidationIssue[] = []
        validate(value, issues)
        if (issues.length)
          return { issues }
        return { value: value as T }
      },
    },
  }
}

export const updateRequestSchema = createSchema<UpdatePluginRequest>((input, issues) => {
  appId(input, issues)
  deviceId(input, issues)
  versionName(input, issues)
  versionBuild(input, issues)
  baseBooleans(input, issues)
  platform(input, issues, false)
  pluginVersion(input, issues)
  optionalString(input, 'defaultChannel', issues)
  optionalString(input, 'key_id', issues, 20)
})

export const statsRequestSchema = createSchema<StatsPluginRequest>((input, issues) => {
  appId(input, issues)
  deviceId(input, issues)
  platform(input, issues, true)
  versionName(input, issues, true)
  versionOs(input, issues)
  baseBooleans(input, issues)
  optionalString(input, 'defaultChannel', issues)
  optionalString(input, 'channel', issues)
  optionalString(input, 'old_version_name', issues)
  optionalString(input, 'version_code', issues)
  optionalString(input, 'plugin_version', issues)
  optionalString(input, 'version_build', issues)
  optionalString(input, 'custom_id', issues, 36)
  optionalString(input, 'key_id', issues, 20)
  optionalAction(input, issues)
  statsMetadata(input, issues)
})

export const channelSelfRequestSchema = createSchema<ChannelSelfPluginRequest>((input, issues) => {
  appId(input, issues)
  deviceId(input, issues)
  versionName(input, issues, true)
  versionBuild(input, issues, true)
  baseBooleans(input, issues)
  platform(input, issues, false)
  optionalString(input, 'defaultChannel', issues)
  optionalString(input, 'channel', issues)
  optionalString(input, 'plugin_version', issues)
  optionalString(input, 'key_id', issues, 20)
})
