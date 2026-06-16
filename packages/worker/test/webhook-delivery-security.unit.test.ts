import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverWebhook, getWebhookRetryDelaySeconds, parseRetryAfterSeconds } from '../src/webhook-delivery-security'

const payload = {
  type: 'releases.INSERT',
  event: 'releases.INSERT',
  event_id: 'event-123',
  timestamp: '2026-03-16T00:00:00.000Z',
  org_id: 'org-123',
  data: { table: 'releases', operation: 'INSERT', record_id: 'version-123' },
}

function dnsResponse(records: string[]) {
  return new Response(JSON.stringify({ Answer: records.map(data => ({ data })) }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('[Capgo parity] webhook delivery security', () => {
  it('does not treat redirect responses as successful deliveries', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com')
        return dnsResponse(['93.184.216.34'])
      return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverWebhook({ deliveryId: 'delivery-2', url: 'https://example.com/webhook', payload, secret: 'secret' })

    expect(result.success).toBe(false)
    expect(result.status).toBe(302)
    const webhookCalls = fetchMock.mock.calls.filter(([url]) => url === 'https://example.com/webhook')
    expect(webhookCalls).toHaveLength(1)
    expect(webhookCalls[0]?.[1]).toMatchObject({ redirect: 'manual' })
  })

  it('caps response bodies while reading webhook delivery previews', async () => {
    let streamCancelled = false
    const oversizedChunk = new Uint8Array(12000).fill('a'.charCodeAt(0))
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversizedChunk)
      },
      cancel() {
        streamCancelled = true
      },
    })
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com')
        return dnsResponse(['93.184.216.34'])
      return new Response(responseBody, { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverWebhook({ deliveryId: 'delivery-large-body', url: 'https://example.com/webhook', payload, secret: 'secret' })

    expect(result.success).toBe(false)
    expect(result.body).toHaveLength(10000)
    expect(streamCancelled).toBe(true)
  })

  it('blocks webhook hosts that resolve to private addresses before delivery', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        const type = url.searchParams.get('type')
        return dnsResponse(type === 'A' ? ['127.0.0.1'] : [])
      }
      return new Response('should not post', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverWebhook({ deliveryId: 'delivery-3', url: 'https://private.example/webhook?token=secret-token', payload, secret: 'secret' })

    expect(result).toMatchObject({
      success: false,
      body: 'Error: Webhook URL must point to a public host',
    })
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('https://private.example/'))).toBe(false)
  })
})

describe('[Capgo parity] webhook retry scheduling', () => {
  it('uses the multi-day retry schedule with deterministic jitter', () => {
    expect(getWebhookRetryDelaySeconds(1, null, 500, 0.5)).toBe(5 * 60)
    expect(getWebhookRetryDelaySeconds(2, null, 500, 0.5)).toBe(5 * 60)
    expect(getWebhookRetryDelaySeconds(3, null, 500, 0.5)).toBe(30 * 60)
    expect(getWebhookRetryDelaySeconds(9, null, 500, 0.5)).toBe(24 * 60 * 60)
  })

  it('honors retry-after and throttles rate-limit responses', () => {
    expect(parseRetryAfterSeconds('120')).toBe(120)
    expect(getWebhookRetryDelaySeconds(1, '600', 429, 0.5)).toBe(600)
    expect(getWebhookRetryDelaySeconds(1, null, 429, 0.5)).toBe(5 * 60)
    expect(getWebhookRetryDelaySeconds(1, '600', 429, 0)).toBe(600)
    expect(getWebhookRetryDelaySeconds(1, null, 429, 0)).toBe(5 * 60)
  })
})