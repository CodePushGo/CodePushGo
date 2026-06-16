import { describe, expect, it, vi } from 'vitest'
import { processWebhookDeliveryQueueMessage, type WebhookQueueDelivery, type WebhookQueueMessage } from '../src/webhook-queue-processing'

const baseDelivery: WebhookQueueDelivery = {
  id: 'delivery-1',
  webhookId: 'webhook-1',
  status: 'pending',
  attemptCount: 0,
  maxAttempts: 4,
}

const message: WebhookQueueMessage = {
  deliveryId: 'delivery-1',
  webhookId: 'webhook-1',
  url: 'https://example.com/webhook',
  payload: { event: 'apps.UPDATE', data: { record_id: 'app-1' } },
}

describe('[Capgo parity] webhook queue processing', () => {
  it('updates delivery records and queues retries after failed attempts', async () => {
    const result = await processWebhookDeliveryQueueMessage(baseDelivery, message, vi.fn().mockResolvedValue({
      success: false,
      status: 405,
      body: 'method not allowed',
      duration: 10,
    }))

    expect(result.status).toBe('ok')
    expect(result.delivery).toMatchObject({
      id: 'delivery-1',
      status: 'pending',
      attemptCount: 1,
      responseStatus: 405,
      responseBody: 'method not allowed',
    })
    expect(result.delivery.nextRetrySeconds).toBeGreaterThan(0)
    expect(result.queuedRetry).toMatchObject({
      deliveryId: 'delivery-1',
      webhookId: 'webhook-1',
      url: 'https://example.com/webhook',
      delaySeconds: result.delivery.nextRetrySeconds,
    })
  })

  it('marks successful deliveries as success and does not queue retries', async () => {
    const result = await processWebhookDeliveryQueueMessage(baseDelivery, message, vi.fn().mockResolvedValue({
      success: true,
      status: 200,
      body: 'ok',
      duration: 10,
    }))

    expect(result.delivery).toMatchObject({ status: 'success', attemptCount: 1, responseStatus: 200, responseBody: 'ok' })
    expect(result.queuedRetry).toBeUndefined()
    expect(result.disabledWebhookId).toBeUndefined()
  })

  it('skips deliveries already completed successfully', async () => {
    const deliver = vi.fn()
    const result = await processWebhookDeliveryQueueMessage({ ...baseDelivery, status: 'success', attemptCount: 1 }, message, deliver)

    expect(result.status).toBe('skipped')
    expect(deliver).not.toHaveBeenCalled()
  })

  it('disables endpoints and stops retrying after 410 Gone', async () => {
    const result = await processWebhookDeliveryQueueMessage(baseDelivery, message, vi.fn().mockResolvedValue({
      success: false,
      status: 410,
      body: 'gone',
      duration: 10,
    }))

    expect(result.delivery).toMatchObject({ status: 'failed', attemptCount: 1, responseStatus: 410 })
    expect(result.disabledWebhookId).toBe('webhook-1')
    expect(result.queuedRetry).toBeUndefined()
  })

  it('marks deliveries failed when max attempts are reached', async () => {
    const result = await processWebhookDeliveryQueueMessage({ ...baseDelivery, attemptCount: 3, maxAttempts: 4 }, message, vi.fn().mockResolvedValue({
      success: false,
      status: 500,
      body: 'receiver failed',
      duration: 10,
    }))

    expect(result.delivery).toMatchObject({ status: 'failed', attemptCount: 4, responseStatus: 500 })
    expect(result.disabledWebhookId).toBe('webhook-1')
    expect(result.queuedRetry).toBeUndefined()
  })
})