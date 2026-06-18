import { buildWebhookApiPath, webhookHeaders } from './webhooks'

export type ApiKeyScopeType = 'org' | 'app'

export interface ApiKeyBinding {
  role_name?: string
  roleName?: string
  scope_type?: ApiKeyScopeType
  scopeType?: ApiKeyScopeType
  org_id?: string
  orgId?: string
  app_id?: string
  appId?: string
  reason?: string
}

export interface ApiKeyRecord {
  id: number
  name: string
  key?: string | null
  key_hash?: string | null
  keyHash?: string | null
  rbac_id?: string | null
  rbacId?: string | null
  bindings?: ApiKeyBinding[]
  global_permissions?: string[]
  globalPermissions?: string[]
  expires_at?: string | null
  expiresAt?: string | null
  created_at?: string | null
  createdAt?: string | null
  updated_at?: string | null
  updatedAt?: string | null
}

export interface ApiKeyOptions {
  apiUrl?: string
  apiKey: string
  fetcher?: typeof fetch
}

export interface ApiKeyInput {
  name: string
  bindings: ApiKeyBinding[]
  expiresAt?: string | null
  globalPermissions?: string[]
}

export interface ApiKeyUpdateInput extends Partial<ApiKeyInput> {
  regenerate?: boolean
}

export const API_KEY_ORG_ROLES = [
  { label: 'Member', value: 'org_member' },
  { label: 'Admin', value: 'org_admin' },
  { label: 'Super admin', value: 'org_super_admin' },
] as const

export const API_KEY_APP_ROLES = [
  { label: 'App reader', value: 'app_reader' },
  { label: 'App uploader', value: 'app_uploader' },
  { label: 'App admin', value: 'app_admin' },
] as const

function getFetcher(fetcher: typeof fetch | undefined) {
  return fetcher ?? fetch
}

async function parseWorkerResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : fallback
    throw new Error(message)
  }
  return data as T
}

export function buildApiKeyPath(path = '/apikey', apiUrl?: string) {
  return buildWebhookApiPath(path, {}, apiUrl)
}

export function buildApiKeyBinding(input: { roleName: string, scopeType: ApiKeyScopeType, orgId?: string, appId?: string, reason?: string }): ApiKeyBinding {
  return {
    role_name: input.roleName,
    roleName: input.roleName,
    scope_type: input.scopeType,
    scopeType: input.scopeType,
    org_id: input.orgId,
    orgId: input.orgId,
    app_id: input.appId,
    appId: input.appId,
    reason: input.reason,
  }
}

export function normalizeApiKeyBinding(binding: ApiKeyBinding): ApiKeyBinding {
  const roleName = binding.roleName ?? binding.role_name ?? ''
  const scopeType = binding.scopeType ?? binding.scope_type ?? 'org'
  const orgId = binding.orgId ?? binding.org_id
  const appId = binding.appId ?? binding.app_id
  return buildApiKeyBinding({ roleName, scopeType, orgId, appId, reason: binding.reason })
}

export function apiKeyBindingsSummary(bindings: ApiKeyBinding[] = []) {
  if (bindings.length === 0)
    return 'No bindings'
  return bindings.map((binding) => {
    const normalized = normalizeApiKeyBinding(binding)
    const scope = normalized.scopeType === 'app' ? normalized.appId || 'app' : normalized.orgId || 'organization'
    return `${normalized.roleName} on ${scope}`
  }).join(', ')
}

export function apiKeyGlobalPermissions(record: Pick<ApiKeyRecord, 'global_permissions' | 'globalPermissions'>) {
  return record.globalPermissions ?? record.global_permissions ?? []
}

export function apiKeyExpiresAt(record: Pick<ApiKeyRecord, 'expires_at' | 'expiresAt'>) {
  return record.expiresAt ?? record.expires_at ?? null
}

export function apiKeyCreatedAt(record: Pick<ApiKeyRecord, 'created_at' | 'createdAt'>) {
  return record.createdAt ?? record.created_at ?? null
}

export function isApiKeyExpired(expiresAt: string | null | undefined) {
  return !!expiresAt && Date.parse(expiresAt) <= Date.now()
}

function serializeApiKeyInput(input: ApiKeyInput | ApiKeyUpdateInput) {
  return {
    name: input.name,
    bindings: input.bindings?.map(normalizeApiKeyBinding),
    expiresAt: input.expiresAt,
    globalPermissions: input.globalPermissions,
    regenerate: 'regenerate' in input ? input.regenerate : undefined,
  }
}

export async function listApiKeys(options: ApiKeyOptions): Promise<ApiKeyRecord[]> {
  const response = await getFetcher(options.fetcher)(buildApiKeyPath('/apikey', options.apiUrl), {
    method: 'GET',
    headers: webhookHeaders(options.apiKey),
  })
  const data = await parseWorkerResponse<unknown>(response, 'Failed to fetch API keys')
  return Array.isArray(data) ? data as ApiKeyRecord[] : []
}

export async function createApiKey(options: ApiKeyOptions, input: ApiKeyInput): Promise<{ success: boolean, apiKey?: ApiKeyRecord, key?: string | null, error?: string }> {
  try {
    const response = await getFetcher(options.fetcher)(buildApiKeyPath('/apikey', options.apiUrl), {
      method: 'POST',
      headers: webhookHeaders(options.apiKey),
      body: JSON.stringify(serializeApiKeyInput(input)),
    })
    const apiKey = await parseWorkerResponse<ApiKeyRecord>(response, 'Failed to create API key')
    return { success: true, apiKey, key: apiKey.key ?? null }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function updateApiKey(options: ApiKeyOptions, id: number, input: ApiKeyUpdateInput): Promise<{ success: boolean, apiKey?: ApiKeyRecord, key?: string | null, error?: string }> {
  try {
    const response = await getFetcher(options.fetcher)(buildApiKeyPath(`/apikey/${id}`, options.apiUrl), {
      method: 'PUT',
      headers: webhookHeaders(options.apiKey),
      body: JSON.stringify(serializeApiKeyInput(input)),
    })
    const apiKey = await parseWorkerResponse<ApiKeyRecord>(response, 'Failed to update API key')
    return { success: true, apiKey, key: apiKey.key ?? null }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function regenerateApiKey(options: ApiKeyOptions, id: number): Promise<{ success: boolean, apiKey?: ApiKeyRecord, key?: string | null, error?: string }> {
  return updateApiKey(options, id, { regenerate: true })
}

export async function deleteApiKey(options: ApiKeyOptions, id: number): Promise<{ success: boolean, error?: string }> {
  try {
    const response = await getFetcher(options.fetcher)(buildApiKeyPath(`/apikey/${id}`, options.apiUrl), {
      method: 'DELETE',
      headers: webhookHeaders(options.apiKey),
    })
    await parseWorkerResponse(response, 'Failed to delete API key')
    return { success: true }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
