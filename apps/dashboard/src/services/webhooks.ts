import { getRegistrationConfig } from './registration'

export type WebhookDeliveryVersion = 'legacy' | 'standard'
export type WebhookDeliveryStatus = 'success' | 'failed' | 'pending'

export interface Webhook {
  id: string
  org_id?: string
  orgId?: string
  name: string
  url: string
  events: string[]
  enabled: boolean
  secret?: string
  delivery_version?: WebhookDeliveryVersion
  deliveryVersion?: WebhookDeliveryVersion
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
  stats_24h?: unknown
}

export interface WebhookDelivery {
  id: string
  webhook_id?: string
  webhookId?: string
  status: WebhookDeliveryStatus | string
  event_type?: string | null
  eventType?: string | null
  response_status?: number | null
  responseStatus?: number | null
  response_body?: string | null
  responseBody?: string | null
  duration_ms?: number | null
  durationMs?: number | null
  created_at?: string | null
  createdAt?: string | null
  payload?: unknown
}

export interface DeliveryPagination {
  page: number
  per_page: number
  total: number
  has_more: boolean
}

export interface TestResult {
  success: boolean
  status?: number | null
  duration_ms?: number | null
  response_preview?: string | null
  delivery_id?: string
  message?: string
}

export const WEBHOOK_EVENT_TYPES = [
  { value: 'apps', label: 'App Changes', description: 'When apps are created, updated, or deleted' },
  { value: 'app_versions', label: 'Bundle Changes', description: 'When bundles are created, updated, or deleted' },
  { value: 'channels', label: 'Channel Updates', description: 'When channels are modified' },
  { value: 'org_users', label: 'Member Changes', description: 'When members are added or removed' },
  { value: 'orgs', label: 'Organization Changes', description: 'When organization settings are updated' },
] as const

interface WebhookRequestOptions {
  apiUrl?: string
  apiKey: string
  fetcher?: typeof fetch
}

interface OrgRequestOptions extends WebhookRequestOptions {
  orgId: string
}

export function normalizeApiUrl(apiUrl = getRegistrationConfig().apiUrl) {
  return apiUrl.replace(/\/+$/, '')
}

export function buildWebhookApiPath(path: string, params: Record<string, string | number | boolean | undefined> = {}, apiUrl = getRegistrationConfig().apiUrl) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined)
      query.set(key, String(value))
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const queryString = query.toString()
  return `${normalizeApiUrl(apiUrl)}${cleanPath}${queryString ? `?${queryString}` : ''}`
}

export function webhookHeaders(apiKey: string): HeadersInit {
  return {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  }
}

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

function validateWebhookEvents(events: string[]) {
  const allowed = WEBHOOK_EVENT_TYPES.map(event => event.value)
  return events.filter(event => !allowed.includes(event as typeof allowed[number]))
}

export function validateWebhookUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname.endsWith('.localhost')
    const isLoopback = parsedUrl.hostname === '127.0.0.1' || parsedUrl.hostname === '::1'
    if (parsedUrl.protocol !== 'https:' && !isLocalhost && !isLoopback)
      return 'Webhook URL must use HTTPS'
    return ''
  }
  catch {
    return 'Invalid URL'
  }
}

export async function listWebhooks(options: OrgRequestOptions): Promise<Webhook[]> {
  const response = await getFetcher(options.fetcher)(buildWebhookApiPath('/webhooks', { orgId: options.orgId }, options.apiUrl), {
    method: 'GET',
    headers: webhookHeaders(options.apiKey),
  })
  const data = await parseWorkerResponse<unknown>(response, 'Failed to fetch webhooks')
  return Array.isArray(data) ? data as Webhook[] : []
}

export async function createWebhook(options: OrgRequestOptions, webhookData: {
  name: string
  url: string
  events: string[]
  deliveryVersion?: WebhookDeliveryVersion
}): Promise<{ success: boolean, webhook?: Webhook, error?: string }> {
  const urlError = validateWebhookUrl(webhookData.url)
  if (urlError)
    return { success: false, error: urlError }

  const invalidEvents = validateWebhookEvents(webhookData.events)
  if (invalidEvents.length > 0)
    return { success: false, error: `Invalid event types: ${invalidEvents.join(', ')}` }

  try {
    const response = await getFetcher(options.fetcher)(buildWebhookApiPath('/webhooks', {}, options.apiUrl), {
      method: 'POST',
      headers: webhookHeaders(options.apiKey),
      body: JSON.stringify({
        orgId: options.orgId,
        name: webhookData.name,
        url: webhookData.url,
        events: webhookData.events,
        enabled: true,
        deliveryVersion: webhookData.deliveryVersion ?? 'legacy',
      }),
    })
    const data = await parseWorkerResponse<{ webhook?: Webhook }>(response, 'Failed to create webhook')
    return { success: true, webhook: data.webhook }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function updateWebhook(options: OrgRequestOptions, webhookId: string, webhookData: Partial<{
  name: string
  url: string
  events: string[]
  enabled: boolean
  deliveryVersion: WebhookDeliveryVersion
}>): Promise<{ success: boolean, webhook?: Webhook, error?: string }> {
  if (webhookData.url) {
    const urlError = validateWebhookUrl(webhookData.url)
    if (urlError)
      return { success: false, error: urlError }
  }

  if (webhookData.events) {
    const invalidEvents = validateWebhookEvents(webhookData.events)
    if (invalidEvents.length > 0)
      return { success: false, error: `Invalid event types: ${invalidEvents.join(', ')}` }
  }

  try {
    const response = await getFetcher(options.fetcher)(buildWebhookApiPath('/webhooks', {}, options.apiUrl), {
      method: 'PUT',
      headers: webhookHeaders(options.apiKey),
      body: JSON.stringify({ orgId: options.orgId, webhookId, ...webhookData }),
    })
    const data = await parseWorkerResponse<{ webhook?: Webhook }>(response, 'Failed to update webhook')
    return { success: true, webhook: data.webhook }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function deleteWebhook(options: OrgRequestOptions, webhookId: string): Promise<{ success: boolean, error?: string }> {
  try {
    const response = await getFetcher(options.fetcher)(buildWebhookApiPath('/webhooks', {}, options.apiUrl), {
      method: 'DELETE',
      headers: webhookHeaders(options.apiKey),
      body: JSON.stringify({ orgId: options.orgId, webhookId }),
    })
    await parseWorkerResponse(response, 'Failed to delete webhook')
    return { success: true }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function testWebhook(options: OrgRequestOptions, webhookId: string): Promise<TestResult> {
  const response = await getFetcher(options.fetcher)(buildWebhookApiPath('/webhooks/test', {}, options.apiUrl), {
    method: 'POST',
    headers: webhookHeaders(options.apiKey),
    body: JSON.stringify({ orgId: options.orgId, webhookId }),
  })
  return await parseWorkerResponse<TestResult>(response, 'Failed to test webhook')
}

export async function fetchWebhookDeliveries(options: OrgRequestOptions, webhookId: string, page = 0, status?: WebhookDeliveryStatus): Promise<{ deliveries: WebhookDelivery[], pagination: DeliveryPagination | null }> {
  const response = await getFetcher(options.fetcher)(buildWebhookApiPath('/webhooks/deliveries', { orgId: options.orgId, webhookId, page, status }, options.apiUrl), {
    method: 'GET',
    headers: webhookHeaders(options.apiKey),
  })
  const data = await parseWorkerResponse<{ deliveries?: WebhookDelivery[], pagination?: DeliveryPagination }>(response, 'Failed to fetch webhook deliveries')
  return { deliveries: data.deliveries ?? [], pagination: data.pagination ?? null }
}

export async function retryWebhookDelivery(options: OrgRequestOptions, deliveryId: string): Promise<{ success: boolean, error?: string }> {
  try {
    const response = await getFetcher(options.fetcher)(buildWebhookApiPath('/webhooks/deliveries/retry', {}, options.apiUrl), {
      method: 'POST',
      headers: webhookHeaders(options.apiKey),
      body: JSON.stringify({ orgId: options.orgId, deliveryId }),
    })
    await parseWorkerResponse(response, 'Failed to retry webhook delivery')
    return { success: true }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
