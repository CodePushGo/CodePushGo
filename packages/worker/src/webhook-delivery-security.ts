import { getPublicHostnameValidationError } from './public-url'

export interface WebhookUrlInfo {
  valid: boolean
  protocol?: string
  hostnameLength?: number
  pathSegmentCount?: number
  hasQuery?: boolean
  hasCredentials?: boolean
}

export interface WebhookDeliveryLogInput {
  delivery_id?: unknown
  webhook_id?: unknown
  url?: unknown
  payload?: unknown
}

export type WebhookDeliveryVersion = 'legacy' | 'standard'

export interface WebhookDeliveryPayload {
  type?: string
  event: string
  event_id: string
  timestamp?: string
  org_id?: string
  data?: unknown
}

export interface WebhookDeliveryResult {
  success: boolean
  status?: number
  body?: string
  duration?: number
  retryAfter?: string | null
}

const textEncoder = new TextEncoder()
const webhookResponseBodyLimitBytes = 10000
const webhookMaxRetryAfterSeconds = 24 * 60 * 60
const webhookRetryDelaysSeconds = [5, 5 * 60, 30 * 60, 2 * 60 * 60, 6 * 60 * 60, 12 * 60 * 60, 24 * 60 * 60, 24 * 60 * 60, 24 * 60 * 60]
const webhookRetryThrottleStatuses = new Set([408, 425, 429, 500, 502, 503, 504])
const webhookPublicUrlMessages = {
  invalidUrl: 'Webhook URL must be a valid URL',
  publicHost: 'Webhook URL must point to a public host',
  ipLiteral: 'Webhook URL must not use a private IP literal',
  https: 'Webhook URL must use HTTPS',
  dnsResolution: 'Webhook URL host could not be resolved',
  fetchFailed: 'Webhook URL could not be fetched',
  tooManyRedirects: 'Webhook URL has too many redirects',
}

function arrayBufferToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  for (const byte of new Uint8Array(buffer))
    binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function decodeSerializedWebhookSecret(secret: string) {
  if (secret.startsWith('whsec_')) {
    try {
      const bytes = decodeBase64(secret.slice('whsec_'.length))
      if (bytes.byteLength >= 24 && bytes.byteLength <= 64)
        return bytes
    }
    catch {
      // Legacy malformed secrets are signed as raw text.
    }
  }
  return textEncoder.encode(secret).buffer
}

export async function generateWebhookSignature(secret: string, timestamp: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${timestamp}.${payload}`))
  return `v1=${timestamp}.${arrayBufferToHex(signature)}`
}

export async function generateStandardWebhookSignature(secret: string, messageId: string, timestamp: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', decodeSerializedWebhookSecret(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${messageId}.${timestamp}.${payload}`))
  return `v1,${arrayBufferToBase64(signature)}`
}

export function buildWebhookDeliveryPayload(payload: WebhookDeliveryPayload, deliveryVersion: WebhookDeliveryVersion) {
  if (deliveryVersion === 'standard')
    return { ...payload, type: payload.type ?? payload.event }
  const { type: _type, ...legacyPayload } = payload
  return legacyPayload
}

export function describeWebhookUrl(url: unknown): WebhookUrlInfo {
  if (typeof url !== 'string' || url.length === 0)
    return { valid: false }

  try {
    const parsed = new URL(url)
    return {
      valid: true,
      protocol: parsed.protocol.replace(/:$/, ''),
      hostnameLength: parsed.hostname.length,
      pathSegmentCount: parsed.pathname.split('/').filter(Boolean).length,
      hasQuery: parsed.search.length > 0,
      hasCredentials: parsed.username.length > 0 || parsed.password.length > 0,
    }
  }
  catch {
    return { valid: false }
  }
}

export function webhookDeliveryReceivedLog(input: WebhookDeliveryLogInput) {
  return {
    message: 'Webhook delivery handler received',
    deliveryId: typeof input.delivery_id === 'string' ? input.delivery_id : undefined,
    webhookId: typeof input.webhook_id === 'string' ? input.webhook_id : undefined,
    urlInfo: describeWebhookUrl(input.url),
  }
}

export function invalidWebhookDeliveryLog(input: WebhookDeliveryLogInput) {
  return {
    message: 'Invalid delivery data',
    hasDeliveryId: typeof input.delivery_id === 'string' && input.delivery_id.length > 0,
    hasWebhookId: typeof input.webhook_id === 'string' && input.webhook_id.length > 0,
    hasUrl: typeof input.url === 'string' && input.url.length > 0,
    hasPayload: input.payload != null,
    urlInfo: describeWebhookUrl(input.url),
  }
}

export function webhookFailureNotificationData(input: { webhookName: string, webhookId: string, url: string }) {
  return {
    webhook_name: input.webhookName,
    webhook_id: input.webhookId,
    webhook_url_info: describeWebhookUrl(input.url),
  }
}

async function readWebhookResponsePreview(response: Response, maxBytes = webhookResponseBodyLimitBytes) {
  const reader = response.body?.getReader()
  if (!reader)
    return ''

  const decoder = new TextDecoder()
  let preview = ''
  let receivedBytes = 0
  let shouldCancel = true

  try {
    while (receivedBytes < maxBytes) {
      const { done, value } = await reader.read()
      if (done) {
        shouldCancel = false
        break
      }
      if (!value)
        continue

      const remainingBytes = maxBytes - receivedBytes
      const chunk = value.byteLength > remainingBytes ? value.subarray(0, remainingBytes) : value
      receivedBytes += chunk.byteLength
      preview += decoder.decode(chunk, { stream: true })
      if (chunk.byteLength < value.byteLength)
        break
    }
    preview += decoder.decode()
    return preview
  }
  finally {
    if (shouldCancel)
      await reader.cancel().catch(() => undefined)
  }
}

export async function deliverWebhook(input: { deliveryId: string, url: string, payload: WebhookDeliveryPayload, secret?: string, deliveryVersion?: WebhookDeliveryVersion }): Promise<WebhookDeliveryResult> {
  const startTime = Date.now()
  const validationError = await getPublicHostnameValidationError(input.url, {
    messages: webhookPublicUrlMessages,
    requireDnsResolution: false,
  })
  if (validationError) {
    return {
      success: false,
      body: `Error: ${validationError}`,
      duration: Date.now() - startTime,
    }
  }

  const deliveryVersion = input.deliveryVersion ?? 'legacy'
  const deliveryPayload = buildWebhookDeliveryPayload(input.payload, deliveryVersion)
  const payloadString = JSON.stringify(deliveryPayload)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const eventId = input.payload.event_id
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'CodePushGo-Webhook/1.0',
    'x-codepushgo-event': input.payload.event,
    'x-codepushgo-event-id': eventId,
    'x-codepushgo-timestamp': timestamp,
  }
  if (input.secret)
    headers['x-codepushgo-signature'] = await generateWebhookSignature(input.secret, timestamp, payloadString)
  if (input.secret && deliveryVersion === 'standard') {
    headers['webhook-id'] = eventId
    headers['webhook-timestamp'] = timestamp
    headers['webhook-signature'] = await generateStandardWebhookSignature(input.secret, eventId, timestamp, payloadString)
  }

  const response = await fetch(input.url, {
    method: 'POST',
    headers,
    body: payloadString,
    redirect: 'manual',
  })

  return {
    success: response.ok,
    status: response.status,
    body: await readWebhookResponsePreview(response),
    duration: Date.now() - startTime,
    retryAfter: response.headers.get('retry-after'),
  }
}

export function parseRetryAfterSeconds(retryAfter: string | null | undefined, now = new Date()) {
  if (!retryAfter)
    return null
  const trimmed = retryAfter.trim()
  if (!trimmed)
    return null
  if (/^\d+$/.test(trimmed))
    return Math.min(Number.parseInt(trimmed, 10), webhookMaxRetryAfterSeconds)
  const retryAt = new Date(trimmed).getTime()
  if (Number.isNaN(retryAt))
    return null
  const seconds = Math.ceil((retryAt - now.getTime()) / 1000)
  if (seconds <= 0)
    return null
  return Math.min(seconds, webhookMaxRetryAfterSeconds)
}

export function getWebhookRetryDelaySeconds(attemptCount: number, retryAfter: string | null | undefined, status: number | null | undefined, randomValue = 0.5) {
  const retryIndex = Math.max(0, Math.min(attemptCount - 1, webhookRetryDelaysSeconds.length - 1))
  let delaySeconds = webhookRetryDelaysSeconds[retryIndex]
  if (status && webhookRetryThrottleStatuses.has(status))
    delaySeconds = Math.max(delaySeconds, 5 * 60)
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfter)
  if (retryAfterSeconds !== null)
    delaySeconds = Math.max(delaySeconds, retryAfterSeconds)
  const minimumDelaySeconds = delaySeconds
  const jitterRange = Math.max(1, Math.ceil(delaySeconds * 0.1))
  const jitter = Math.floor(randomValue * (jitterRange * 2 + 1)) - jitterRange
  return Math.max(minimumDelaySeconds, Math.min(webhookMaxRetryAfterSeconds, delaySeconds + jitter))
}
