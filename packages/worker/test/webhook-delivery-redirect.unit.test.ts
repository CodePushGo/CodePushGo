import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverWebhook } from '../src/webhook-delivery-security'

const payload = {
  type: 'releases.INSERT',
  event: 'releases.INSERT',
  event_id: 'event-123',
  timestamp: '2026-03-16T00:00:00.000Z',
  org_id: 'org-123',
  data: {
    table: 'releases',
    operation: 'INSERT',
    record_id: 'version-123',
    old_record: null,
    new_record: { id: 'version-123' },
    changed_fields: ['id'],
  },
}

describe('[Capgo parity] webhook delivery redirect handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.concurrent('uses manual redirect mode for outbound webhook delivery', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('redirect blocked', {
      status: 302,
      headers: {
        location: 'http://169.254.169.254/latest/meta-data',
      },
    }))

    const result = await deliverWebhook({
      deliveryId: 'delivery-123',
      url: 'https://example.com/webhook',
      payload,
      secret: 'whsec_test_secret',
    })

    const webhookCalls = fetchMock.mock.calls.filter(([url]) => url === 'https://example.com/webhook')
    expect(webhookCalls).toHaveLength(1)
    expect(webhookCalls[0]?.[1]).toMatchObject({
      method: 'POST',
      redirect: 'manual',
    })
    expect(result).toMatchObject({
      success: false,
      status: 302,
      body: 'redirect blocked',
    })
  })
})