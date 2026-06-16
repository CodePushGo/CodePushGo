import type { Platform } from '@codepushgo/shared'

export interface ApiOptions {
  endpoint: string
  token: string
  fetch?: typeof fetch
}

export interface UploadBundleInput {
  appId: string
  version: string
  platform: Platform
  channel: string
  bytes: Uint8Array
  checksum: string
  sessionKey?: string
  keyId?: string
  mandatory?: boolean
  rollout?: number
  notes?: string
  minUpdateVersion?: string | null
  nativePackages?: Array<{ name: string, version: string, ios_checksum?: string, android_checksum?: string }>
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const body = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(body).set(bytes)
  return body
}

export class CodePushGoApi {
  private readonly endpoint: string
  private readonly fetcher: typeof fetch

  constructor(private readonly options: ApiOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, '')
    this.fetcher = options.fetch ?? fetch
  }

  async createApp(appId: string, name = appId) {
    return this.request('/v1/apps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appId, app_id: appId, bundle_id: appId, name, owner_org: 'default-org' }),
    })
  }

  async listApps() {
    return this.request('/v1/apps')
  }

  async listBundles(appId: string) {
    return this.request(`/v1/apps/${encodeURIComponent(appId)}/bundles`)
  }

  async uploadBundle(input: UploadBundleInput) {
    return this.request(`/v1/apps/${encodeURIComponent(input.appId)}/bundles`, {
      method: 'POST',
      headers: {
        'content-type': 'application/zip',
        'x-codepushgo-version': input.version,
        'x-codepushgo-platform': input.platform,
        ...(input.sessionKey ? { 'x-codepushgo-session-key': input.sessionKey } : {}),
        ...(input.keyId ? { 'x-codepushgo-key-id': input.keyId } : {}),
        'x-codepushgo-channel': input.channel,
        'x-codepushgo-checksum': input.checksum,
        'x-codepushgo-mandatory': String(input.mandatory ?? false),
        ...(input.minUpdateVersion ? { 'x-codepushgo-min-update-version': input.minUpdateVersion } : {}),
        ...(input.nativePackages ? { 'x-codepushgo-native-packages': JSON.stringify(input.nativePackages) } : {}),
        'x-codepushgo-rollout': String(input.rollout ?? 100),
        ...(input.notes ? { 'x-codepushgo-notes': input.notes } : {}),
      },
      body: new Blob([toArrayBuffer(input.bytes)], { type: 'application/zip' }),
    })
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${this.options.token}`)

    const response = await this.fetcher(`${this.endpoint}${path}`, { ...init, headers })
    const body = await response.json().catch(() => undefined)
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : response.statusText
      throw new Error(message || `Request failed with status ${response.status}`)
    }
    return body
  }
}
