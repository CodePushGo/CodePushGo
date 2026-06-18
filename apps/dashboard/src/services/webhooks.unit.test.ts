import { describe, expect, it, vi } from 'vitest'
import {
  buildWebhookApiPath,
  createWebhook,
  fetchWebhookDeliveries,
  listWebhooks,
  retryWebhookDelivery,
  testWebhook,
  updateWebhook,
  validateWebhookUrl,
  WEBHOOK_EVENT_TYPES,
  webhookHeaders,
} from './webhooks'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

const options = {
  apiUrl: 'https://api.example.com/',
  apiKey: 'cpg_test',
  orgId: 'org_123',
}

describe('[Capgo parity] Worker-backed webhook service', () => {
  it('keeps the Capgo webhook event surface', () => {
    expect(WEBHOOK_EVENT_TYPES.map(event => event.value)).toEqual(['apps', 'app_versions', 'channels', 'org_users', 'orgs'])
  })

  it('builds Worker URLs and bearer headers without Supabase Edge Functions', () => {
    expect(buildWebhookApiPath('webhooks', { orgId: 'org_123', page: 1 }, 'https://api.example.com/')).toBe('https://api.example.com/webhooks?orgId=org_123&page=1')
    expect(webhookHeaders('cpg_test')).toEqual({ authorization: 'Bearer cpg_test', 'content-type': 'application/json' })
  })

  it('validates webhook URLs like Capgo', () => {
    expect(validateWebhookUrl('https://example.com/hook')).toBe('')
    expect(validateWebhookUrl('http://localhost:8787/hook')).toBe('')
    expect(validateWebhookUrl('http://127.0.0.1:8787/hook')).toBe('')
    expect(validateWebhookUrl('http://example.com/hook')).toBe('Webhook URL must use HTTPS')
    expect(validateWebhookUrl('not-url')).toBe('Invalid URL')
  })

  it('lists webhooks through GET /webhooks', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: 'wh_1', name: 'Deploys', url: 'https://example.com', events: ['apps'], enabled: true }]))
    await expect(listWebhooks({ ...options, fetcher })).resolves.toHaveLength(1)
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/webhooks?orgId=org_123', {
      method: 'GET',
      headers: webhookHeaders('cpg_test'),
    })
  })

  it('creates and updates webhooks through the Worker body contract', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ webhook: { id: 'wh_1' } }))
    await expect(createWebhook({ ...options, fetcher }, { name: 'Deploys', url: 'https://example.com/hook', events: ['apps'] })).resolves.toMatchObject({ success: true })
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][]
    expect(JSON.parse(String(calls[0][1].body))).toEqual({
      orgId: 'org_123',
      name: 'Deploys',
      url: 'https://example.com/hook',
      events: ['apps'],
      enabled: true,
      deliveryVersion: 'legacy',
    })

    await expect(updateWebhook({ ...options, fetcher }, 'wh_1', { enabled: false, deliveryVersion: 'standard' })).resolves.toMatchObject({ success: true })
    expect(JSON.parse(String(calls[1][1].body))).toEqual({
      orgId: 'org_123',
      webhookId: 'wh_1',
      enabled: false,
      deliveryVersion: 'standard',
    })
  })

  it('tests, lists deliveries, and retries deliveries through Worker endpoints', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/webhooks/test'))
        return jsonResponse({ success: true, message: 'ok' })
      if (url.includes('/webhooks/deliveries?'))
        return jsonResponse({ deliveries: [{ id: 'del_1', status: 'failed' }], pagination: { page: 0, per_page: 50, total: 1, has_more: false } })
      return jsonResponse({ status: 'Delivery queued' })
    })

    await expect(testWebhook({ ...options, fetcher }, 'wh_1')).resolves.toMatchObject({ success: true })
    await expect(fetchWebhookDeliveries({ ...options, fetcher }, 'wh_1', 0, 'failed')).resolves.toMatchObject({ deliveries: [{ id: 'del_1', status: 'failed' }] })
    await expect(retryWebhookDelivery({ ...options, fetcher }, 'del_1')).resolves.toMatchObject({ success: true })
    expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([
      'https://api.example.com/webhooks/test',
      'https://api.example.com/webhooks/deliveries?orgId=org_123&webhookId=wh_1&page=0&status=failed',
      'https://api.example.com/webhooks/deliveries/retry',
    ])
  })
})
