import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const originalFetch = globalThis.fetch

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
  const headers = { authorization: 'Bearer test-token', 'content-type': 'application/json' }
  return { app, env, storage, headers }
}

async function seedOrg(storage: MemoryStorage, orgId = 'org-webhooks') {
  await storage.upsertOrganization({ id: orgId, name: 'Webhook Org' })
  return orgId
}

function stubWebhookFetch(status = 200, body = 'ok') {
  globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
    const value = String(url)
    if (value.startsWith('https://cloudflare-dns.com/dns-query')) {
      return new Response(JSON.stringify({ Answer: [{ data: '93.184.216.34' }] }), {
        status: 200,
        headers: { 'content-type': 'application/dns-json' },
      })
    }
    return new Response(body, { status })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('[Capgo parity] /webhooks Worker endpoints', () => {
  it('creates, lists, reads, updates, tests, lists deliveries, retries, and deletes webhooks', async () => {
    const { app, env, storage, headers } = testApp()
    const orgId = await seedOrg(storage)
    stubWebhookFetch()

    const createResponse = await app.request('https://api.test/webhooks', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orgId,
        name: 'Deploy hook',
        url: 'https://example.com/webhook',
        events: ['app_versions'],
        deliveryVersion: 'standard',
      }),
    }, env)
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as { status: string, webhook: { id: string, secret?: string, delivery_version: string } }
    expect(created.status).toBe('Webhook created')
    expect(created.webhook.secret).toMatch(/^whsec_[A-Za-z0-9+/]+={0,2}$/)
    expect(created.webhook.delivery_version).toBe('standard')

    const listResponse = await app.request(`https://api.test/webhooks?orgId=${orgId}`, { headers }, env)
    expect(listResponse.status).toBe(200)
    const listed = await listResponse.json() as Array<{ id: string, secret?: string }>
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ id: created.webhook.id })
    expect(listed[0]?.secret).toBeUndefined()

    const getResponse = await app.request(`https://api.test/webhooks?orgId=${orgId}&webhookId=${created.webhook.id}`, { headers }, env)
    expect(getResponse.status).toBe(200)
    const single = await getResponse.json() as { id: string, secret?: string, stats_24h: { success: number, failed: number, pending: number } }
    expect(single.secret).toBeUndefined()
    expect(single.stats_24h).toEqual({ success: 0, failed: 0, pending: 0 })

    const updateResponse = await app.request('https://api.test/webhooks', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ orgId, webhookId: created.webhook.id, name: 'Updated hook', events: ['app_versions', 'channels'], deliveryVersion: 'legacy' }),
    }, env)
    expect(updateResponse.status).toBe(200)
    const updated = await updateResponse.json() as { webhook: { name: string, secret?: string, delivery_version: string, events: string[] } }
    expect(updated.webhook).toMatchObject({ name: 'Updated hook', delivery_version: 'legacy', events: ['app_versions', 'channels'] })
    expect(updated.webhook.secret).toBeUndefined()

    const testResponse = await app.request('https://api.test/webhooks/test', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, webhookId: created.webhook.id }),
    }, env)
    expect(testResponse.status).toBe(200)
    const tested = await testResponse.json() as { success: boolean, delivery_id: string }
    expect(tested.success).toBe(true)

    const delivery = await storage.getWebhookDelivery(tested.delivery_id)
    expect(delivery).toMatchObject({ deliveryVersion: 'legacy', status: 'success', eventType: 'test.ping' })
    expect(delivery?.requestPayload).not.toHaveProperty('type')

    const deliveriesResponse = await app.request(`https://api.test/webhooks/deliveries?orgId=${orgId}&webhookId=${created.webhook.id}&page=0`, { headers }, env)
    expect(deliveriesResponse.status).toBe(200)
    const deliveries = await deliveriesResponse.json() as { deliveries: unknown[], pagination: { page: number, per_page: number, total: number, has_more: boolean } }
    expect(deliveries.deliveries).toHaveLength(1)
    expect(deliveries.pagination).toEqual({ page: 0, per_page: 50, total: 1, has_more: false })

    const retrySuccessResponse = await app.request('https://api.test/webhooks/deliveries/retry', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, deliveryId: tested.delivery_id }),
    }, env)
    expect(retrySuccessResponse.status).toBe(400)
    expect(await retrySuccessResponse.json()).toMatchObject({ error: 'delivery_not_failed' })

    await storage.updateWebhookDelivery(tested.delivery_id, { status: 'failed', responseStatus: 500, responseBody: 'failed', attemptCount: 1 })
    const retryResponse = await app.request('https://api.test/webhooks/deliveries/retry', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, deliveryId: tested.delivery_id }),
    }, env)
    expect(retryResponse.status).toBe(200)
    expect(await retryResponse.json()).toMatchObject({ status: 'Delivery queued for retry', deliveryId: tested.delivery_id })
    expect(await storage.getWebhookDelivery(tested.delivery_id)).toMatchObject({ status: 'pending', attemptCount: 0, responseStatus: null })

    const deleteResponse = await app.request(`https://api.test/webhooks?orgId=${orgId}&webhookId=${created.webhook.id}`, { method: 'DELETE', headers }, env)
    expect(deleteResponse.status).toBe(200)
    expect(await deleteResponse.json()).toMatchObject({ status: 'Webhook deleted', webhookId: created.webhook.id })
  })

  it('validates required body, event names, delivery version, URL safety, and org scope', async () => {
    const { app, env, storage, headers } = testApp()
    const orgId = await seedOrg(storage)

    const missingOrgResponse = await app.request('https://api.test/webhooks', { headers }, env)
    expect(missingOrgResponse.status).toBe(400)
    expect(await missingOrgResponse.json()).toMatchObject({ error: 'invalid_body' })

    const invalidOrgResponse = await app.request('https://api.test/webhooks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId: 'missing-org', name: 'Bad org', url: 'https://example.com/webhook', events: ['app_versions'] }),
    }, env)
    expect(invalidOrgResponse.status).toBe(400)
    expect(await invalidOrgResponse.json()).toMatchObject({ error: 'invalid_org_id' })

    const invalidEventsResponse = await app.request('https://api.test/webhooks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, name: 'Bad event', url: 'https://example.com/webhook', events: ['bad_event'] }),
    }, env)
    expect(invalidEventsResponse.status).toBe(400)
    expect(await invalidEventsResponse.json()).toMatchObject({ error: 'invalid_events' })

    const invalidVersionResponse = await app.request('https://api.test/webhooks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, name: 'Bad version', url: 'https://example.com/webhook', events: ['app_versions'], deliveryVersion: 'bad' }),
    }, env)
    expect(invalidVersionResponse.status).toBe(400)
    expect(await invalidVersionResponse.json()).toMatchObject({ error: 'invalid_delivery_version' })

    const invalidUrlResponse = await app.request('https://api.test/webhooks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, name: 'Bad URL', url: 'http://example.com/webhook?token=secret-token', events: ['app_versions'] }),
    }, env)
    expect(invalidUrlResponse.status).toBe(400)
    const invalidUrl = await invalidUrlResponse.json() as { error: string, moreInfo?: unknown }
    expect(invalidUrl.error).toBe('invalid_url')
    expect(JSON.stringify(invalidUrl)).not.toContain('secret-token')
    expect(invalidUrl.moreInfo).toMatchObject({ urlInfo: { valid: true, protocol: 'http', hasQuery: true } })
  })
})
