import { createHmac, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildWebhookDeliveryPayload, deliverWebhook, generateStandardWebhookSignature, generateWebhookSignature } from '../src/webhook-delivery-security'

const testSecret = `whsec_${Buffer.from('12345678901234567890123456789012').toString('base64')}`
const messageId = '123e4567-e89b-12d3-a456-426614174000'
const testTimestamp = '1704067200'
const testPayload = JSON.stringify({
  type: 'releases.INSERT',
  event: 'releases.INSERT',
  event_id: messageId,
  timestamp: '2024-01-01T00:00:00.000Z',
  org_id: 'org-123',
  data: { table: 'releases', operation: 'INSERT', record_id: 'version-123' },
})

function verifyStandardWebhookSignature(signature: string, secret: string, id: string, timestamp: string, body: string) {
  const secretBytes = secret.startsWith('whsec_') ? Buffer.from(secret.slice('whsec_'.length), 'base64') : Buffer.from(secret)
  const expectedSignature = `v1,${createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${body}`).digest('base64')}`
  return signature.split(' ').some(candidate => candidate.length === expectedSignature.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(expectedSignature)))
}

function dnsResponse(records: string[]) {
  return new Response(JSON.stringify({ Answer: records.map(data => ({ data })) }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('[Capgo parity] webhook signature algorithm', () => {
  it('generates Standard Webhooks signature format v1,{base64}', async () => {
    const signature = await generateStandardWebhookSignature(testSecret, messageId, testTimestamp, testPayload)
    expect(signature).toMatch(/^v1,[A-Za-z0-9+/]+={0,2}$/)
  })

  it('produces deterministic and input-sensitive Standard Webhooks signatures', async () => {
    const sig1 = await generateStandardWebhookSignature(testSecret, messageId, testTimestamp, testPayload)
    expect(await generateStandardWebhookSignature(testSecret, messageId, testTimestamp, testPayload)).toBe(sig1)
    expect(await generateStandardWebhookSignature(testSecret, 'different-message-id', testTimestamp, testPayload)).not.toBe(sig1)
    expect(await generateStandardWebhookSignature(testSecret, messageId, '1704153600', testPayload)).not.toBe(sig1)
    expect(await generateStandardWebhookSignature(testSecret, messageId, testTimestamp, '{"different":"payload"}')).not.toBe(sig1)
  })

  it('matches Node.js crypto Standard Webhooks HMAC generation', async () => {
    const signature = await generateStandardWebhookSignature(testSecret, messageId, testTimestamp, testPayload)
    const [, hmac] = signature.split(',')
    const expectedHmac = createHmac('sha256', Buffer.from(testSecret.slice('whsec_'.length), 'base64'))
      .update(`${messageId}.${testTimestamp}.${testPayload}`)
      .digest('base64')

    expect(hmac).toBe(expectedHmac)
    expect(verifyStandardWebhookSignature(signature, testSecret, messageId, testTimestamp, testPayload)).toBe(true)
    expect(verifyStandardWebhookSignature(signature, testSecret, messageId, testTimestamp, '{}')).toBe(false)
  })

  it('keeps generating the legacy Capgo signature format', async () => {
    const signature = await generateWebhookSignature(testSecret, testTimestamp, testPayload)
    const [, timestampAndHmac] = signature.split('=')
    const [, hmac] = timestampAndHmac.split('.')
    const expectedHmac = createHmac('sha256', testSecret).update(`${testTimestamp}.${testPayload}`).digest('hex')

    expect(signature).toMatch(/^v1=\d+\.[a-f0-9]{64}$/i)
    expect(hmac).toBe(expectedHmac)
  })

  it('shapes legacy and standard webhook payloads', () => {
    const payload = { type: 'releases.INSERT', event: 'releases.INSERT', event_id: 'event-1' }
    expect(buildWebhookDeliveryPayload(payload, 'legacy')).toEqual({ event: 'releases.INSERT', event_id: 'event-1' })
    expect(buildWebhookDeliveryPayload({ event: 'releases.INSERT', event_id: 'event-1' }, 'standard')).toEqual({ type: 'releases.INSERT', event: 'releases.INSERT', event_id: 'event-1' })
  })
})

describe('[Capgo parity] webhook delivery signature headers', () => {
  it('sends Standard Webhooks and legacy signature headers for standard delivery', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com')
        return dnsResponse(['93.184.216.34'])
      return new Response('ok', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverWebhook({
      deliveryId: 'delivery-standard',
      url: 'https://example.com/webhook',
      payload: { type: 'releases.INSERT', event: 'releases.INSERT', event_id: 'event-standard' },
      secret: testSecret,
      deliveryVersion: 'standard',
    })

    expect(result.success).toBe(true)
    const webhookCall = fetchMock.mock.calls.find(([url]) => url === 'https://example.com/webhook')
    const headers = webhookCall?.[1]?.headers as Record<string, string>
    expect(headers['webhook-id']).toBe('event-standard')
    expect(headers['webhook-timestamp']).toMatch(/^\d+$/)
    expect(headers['webhook-signature']).toMatch(/^v1,[A-Za-z0-9+/]+={0,2}$/)
    expect(headers['x-codepushgo-signature']).toMatch(/^v1=\d+\.[a-f0-9]{64}$/)
  })

  it('uses legacy payload and headers by default', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com')
        return dnsResponse(['93.184.216.34'])
      return new Response('ok', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverWebhook({
      deliveryId: 'delivery-legacy',
      url: 'https://example.com/webhook',
      payload: { type: 'releases.INSERT', event: 'releases.INSERT', event_id: 'event-legacy' },
      secret: testSecret,
    })

    expect(result.success).toBe(true)
    const webhookCall = fetchMock.mock.calls.find(([url]) => url === 'https://example.com/webhook')
    const headers = webhookCall?.[1]?.headers as Record<string, string>
    const body = JSON.parse(webhookCall?.[1]?.body as string) as Record<string, unknown>
    expect(headers['webhook-id']).toBeUndefined()
    expect(headers['webhook-signature']).toBeUndefined()
    expect(headers['x-codepushgo-event-id']).toBe('event-legacy')
    expect(headers['x-codepushgo-signature']).toMatch(/^v1=\d+\.[a-f0-9]{64}$/)
    expect(body.type).toBeUndefined()
    expect(body.event).toBe('releases.INSERT')
  })
})