import type { Platform, StatsAction, UpdateResponse } from '@codepushgo/shared'

export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}

export interface FetchLike {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>
}

export interface CodePushGoRuntimeConfig {
  appId?: string
  bundleId?: string
  endpoint?: string
  channel?: string
  autoUpdate?: boolean
}

export interface CodePushGoClientOptions {
  appId?: string
  bundleId?: string
  endpoint?: string
  platform: Platform
  currentVersion: string
  channel?: string
  deviceId?: string
  pluginVersion?: string
  autoUpdate?: boolean
  fetch?: FetchLike
  storage?: StorageAdapter
}

export interface CheckForUpdateOptions {
  currentVersion?: string
  channel?: string
  deviceId?: string
}

export interface ChannelSelfRequestOptions {
  deviceId?: string
  defaultChannel?: string
}

export interface ChannelSelfRecord {
  id?: string | number
  name: string
  public: boolean
  allow_self_set?: boolean
  allowSelfSet?: boolean
}

export interface ChannelSelfState {
  status: 'ok' | 'override' | 'default'
  channel?: string
}

export interface DownloadedUpdate {
  update: Extract<UpdateResponse, { available: true }>
  bytes: ArrayBuffer
}

export interface StartedCodePushGo {
  client: CodePushGoClient
  update?: UpdateResponse
  downloaded?: DownloadedUpdate
}

type UnknownRecord = Record<string, unknown>

interface ExpoGlobal {
  expoConfig?: {
    ios?: { bundleIdentifier?: string }
    android?: { package?: string }
  }
  manifest?: {
    ios?: { bundleIdentifier?: string }
    android?: { package?: string }
  }
}

interface RuntimeGlobal {
  __CODEPUSHGO_CONFIG__?: CodePushGoRuntimeConfig
  __CODEPUSHGO_BUNDLE_ID__?: string
  Expo?: ExpoGlobal
  require?: (name: string) => unknown
}

const pendingUpdateKey = 'codepushgo:pending-update'
const deviceIdKey = 'codepushgo:device-id'

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function runtimeGlobal() {
  return globalThis as unknown as RuntimeGlobal
}

function trimEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, '')
}

function requireFetch(fetcher?: FetchLike): FetchLike {
  const resolved = fetcher ?? globalThis.fetch
  if (!resolved)
    throw new Error('A fetch implementation is required')
  return resolved.bind(globalThis) as FetchLike
}

function randomId() {
  const randomUUID = globalThis.crypto?.randomUUID
  if (randomUUID)
    return randomUUID.call(globalThis.crypto)
  return `device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function objectValue(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : undefined
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const resolved = stringValue(value)
    if (resolved)
      return resolved
  }
  return undefined
}

function expoBundleIdFromConfig(value: unknown, platform: Platform) {
  const source = objectValue(value)
  if (!source)
    return undefined
  const expo = objectValue(source.expo) ?? source
  const ios = objectValue(expo.ios)
  const android = objectValue(expo.android)
  return platform === 'ios'
    ? stringValue(ios?.bundleIdentifier)
    : stringValue(android?.package)
}

function expoBundleId(platform: Platform) {
  return expoBundleIdFromConfig(runtimeGlobal().Expo, platform)
}

function globalBundleId() {
  return stringValue(runtimeGlobal().__CODEPUSHGO_BUNDLE_ID__)
}

function loadReactNativeModule() {
  const requireFn = runtimeGlobal().require
  if (!requireFn)
    return undefined
  try {
    return objectValue(requireFn('react-native'))
  }
  catch {
    return undefined
  }
}

function moduleConstants(module: UnknownRecord | undefined) {
  const getConstants = module?.getConstants
  if (typeof getConstants !== 'function')
    return undefined
  return objectValue(getConstants.call(module))
}

function reactNativeBundleId(platform: Platform) {
  const reactNative = loadReactNativeModule()
  const nativeModules = objectValue(reactNative?.NativeModules)
  const platformModule = objectValue(nativeModules?.PlatformConstants)
  const platformConstants = objectValue(objectValue(reactNative?.Platform)?.constants)
  const codePushGoModule = objectValue(nativeModules?.CodePushGo) ?? objectValue(nativeModules?.RNCodePushGo)
  const codePushGoConstants = moduleConstants(codePushGoModule)
  const expoConstants = objectValue(nativeModules?.ExpoConstants)
  const applicationInfo = objectValue(nativeModules?.ApplicationInfo)
  const constants = platformConstants ?? moduleConstants(platformModule) ?? platformModule

  return firstString(
    codePushGoModule?.bundleId,
    codePushGoModule?.appId,
    codePushGoConstants?.bundleId,
    codePushGoConstants?.appId,
    expoBundleIdFromConfig(expoConstants?.expoConfig, platform),
    expoBundleIdFromConfig(expoConstants?.manifest, platform),
    expoBundleIdFromConfig(objectValue(objectValue(expoConstants?.manifest2)?.extra)?.expoClient, platform),
    platform === 'ios' ? constants?.BundleIdentifier : constants?.applicationId,
    platform === 'ios' ? constants?.bundleIdentifier : constants?.packageName,
    platform === 'ios' ? applicationInfo?.bundleIdentifier : applicationInfo?.applicationId,
  )
}

function runtimeBundleId(platform: Platform) {
  return globalBundleId()
    ?? expoBundleId(platform)
    ?? reactNativeBundleId(platform)
}

function resolveBundleId(options: CodePushGoClientOptions) {
  const runtime = runtimeGlobal().__CODEPUSHGO_CONFIG__
  const nativeBundleId = runtimeBundleId(options.platform)
  const bundleId = options.bundleId
    ?? options.appId
    ?? nativeBundleId
    ?? runtime?.bundleId
    ?? runtime?.appId
  if (!bundleId) {
    throw new Error('CodePushGo bundleId is required. Pass bundleId/appId or expose the native React Native bundle identifier.')
  }

  return bundleId
}

function resolveEndpoint(options: CodePushGoClientOptions) {
  const endpoint = options.endpoint ?? runtimeGlobal().__CODEPUSHGO_CONFIG__?.endpoint
  if (!endpoint)
    throw new Error('CodePushGo endpoint is required')
  return trimEndpoint(endpoint)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body ? String(body.message) : response.statusText
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return body as T
}

export function configureCodePushGo(config: CodePushGoRuntimeConfig) {
  runtimeGlobal().__CODEPUSHGO_CONFIG__ = {
    ...runtimeGlobal().__CODEPUSHGO_CONFIG__,
    ...config,
  }
}

export function clearCodePushGoConfig() {
  delete runtimeGlobal().__CODEPUSHGO_CONFIG__
  delete runtimeGlobal().__CODEPUSHGO_BUNDLE_ID__
}

export function getCodePushGoBundleId(platform: Platform) {
  return runtimeBundleId(platform)
}

export class CodePushGoClient {
  private readonly appId: string
  private readonly endpoint: string
  private readonly storage: StorageAdapter
  private readonly fetcher: FetchLike

  constructor(private readonly options: CodePushGoClientOptions) {
    this.appId = resolveBundleId(options)
    this.endpoint = resolveEndpoint(options)
    this.storage = options.storage ?? new MemoryStorage()
    this.fetcher = requireFetch(options.fetch)
  }

  async getDeviceId() {
    if (this.options.deviceId)
      return this.options.deviceId

    const stored = await this.storage.getItem(deviceIdKey)
    if (stored)
      return stored

    const generated = randomId()
    await this.storage.setItem(deviceIdKey, generated)
    return generated
  }

  private async channelSelfPayload(options: ChannelSelfRequestOptions = {}) {
    const runtime = runtimeGlobal().__CODEPUSHGO_CONFIG__
    return {
      app_id: this.appId,
      bundle_id: this.appId,
      device_id: options.deviceId ?? await this.getDeviceId(),
      platform: this.options.platform,
      version_name: this.options.currentVersion,
      plugin_version: this.options.pluginVersion ?? '0.1.0',
      defaultChannel: options.defaultChannel ?? this.options.channel ?? runtime?.channel ?? 'production',
    }
  }

  async checkForUpdate(options: CheckForUpdateOptions = {}): Promise<UpdateResponse> {
    const runtime = runtimeGlobal().__CODEPUSHGO_CONFIG__
    const defaultChannel = this.options.channel ?? runtime?.channel ?? 'production'
    const body: Record<string, unknown> = {
      app_id: this.appId,
      bundle_id: this.appId,
      device_id: options.deviceId ?? await this.getDeviceId(),
      platform: this.options.platform,
      version_name: options.currentVersion ?? this.options.currentVersion,
      plugin_version: this.options.pluginVersion ?? '0.1.0',
      defaultChannel,
    }
    if (options.channel)
      body.channel = options.channel

    const response = await this.fetcher(`${this.endpoint}/updates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    return parseJsonResponse<UpdateResponse>(response)
  }

  async listChannels(options: ChannelSelfRequestOptions = {}): Promise<ChannelSelfRecord[]> {
    const payload = await this.channelSelfPayload(options)
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(payload))
      query.set(key, String(value))

    const response = await this.fetcher(`${this.endpoint}/channel_self?${query.toString()}`, {
      method: 'GET',
    })
    return parseJsonResponse<ChannelSelfRecord[]>(response)
  }

  async getChannel(options: ChannelSelfRequestOptions = {}): Promise<ChannelSelfState> {
    const response = await this.fetcher(`${this.endpoint}/channel_self`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(await this.channelSelfPayload(options)),
    })
    return parseJsonResponse<ChannelSelfState>(response)
  }

  async setChannel(channel: string, options: ChannelSelfRequestOptions = {}): Promise<ChannelSelfState> {
    const response = await this.fetcher(`${this.endpoint}/channel_self`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...await this.channelSelfPayload(options), channel }),
    })
    return parseJsonResponse<ChannelSelfState>(response)
  }

  async unsetChannel(options: ChannelSelfRequestOptions = {}): Promise<{ status: 'ok' }> {
    const payload = await this.channelSelfPayload(options)
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(payload))
      query.set(key, String(value))

    const response = await this.fetcher(`${this.endpoint}/channel_self?${query.toString()}`, {
      method: 'DELETE',
    })
    return parseJsonResponse<{ status: 'ok' }>(response)
  }

  async downloadUpdate(update: Extract<UpdateResponse, { available: true }>): Promise<DownloadedUpdate> {
    await this.reportStats('download_start', { version: update.version })
    const response = await this.fetcher(update.url)
    if (!response.ok) {
      await this.reportStats('download_fail', { version: update.version, status: response.status })
      throw new Error(`Download failed with status ${response.status}`)
    }

    const bytes = await response.arrayBuffer()
    await this.rememberPendingUpdate(update)
    await this.reportStats('download_complete', { version: update.version, size: bytes.byteLength })
    return { update, bytes }
  }

  async notifyAppReady() {
    await this.reportStats('app_ready')
    return { status: 'ok' as const }
  }

  async reportStats(action: StatsAction, metadata?: Record<string, unknown>) {
    const response = await this.fetcher(`${this.endpoint}/stats`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        bundle_id: this.appId,
        device_id: await this.getDeviceId(),
        platform: this.options.platform,
        version_name: this.options.currentVersion,
        plugin_version: this.options.pluginVersion ?? '0.1.0',
        action,
        metadata,
      }),
    })

    await parseJsonResponse(response)
  }

  async rememberPendingUpdate(update: Extract<UpdateResponse, { available: true }>) {
    await this.storage.setItem(pendingUpdateKey, JSON.stringify(update))
  }

  async getPendingUpdate(): Promise<Extract<UpdateResponse, { available: true }> | undefined> {
    const value = await this.storage.getItem(pendingUpdateKey)
    return value ? JSON.parse(value) : undefined
  }

  async clearPendingUpdate() {
    await this.storage.removeItem(pendingUpdateKey)
  }
}

export function createCodePushGoClient(options: CodePushGoClientOptions) {
  return new CodePushGoClient(options)
}

export async function startCodePushGo(options: CodePushGoClientOptions): Promise<StartedCodePushGo> {
  const client = createCodePushGoClient(options)
  const runtime = runtimeGlobal().__CODEPUSHGO_CONFIG__
  const autoUpdate = options.autoUpdate ?? runtime?.autoUpdate ?? true
  if (!autoUpdate)
    return { client }

  const update = await client.checkForUpdate()
  if (!update.available)
    return { client, update }

  const downloaded = await client.downloadUpdate(update)
  return { client, update, downloaded }
}

export type { Platform, StatsAction, UpdateResponse }
export {
  normalizeAutoUpdateMode,
  normalizePeriodCheckDelay,
  normalizeUpdateResponseKind,
} from './native-contract'
