import type { WebhookDeliveryResult } from './webhook-delivery-security'
import { getWebhookRetryDelaySeconds } from './webhook-delivery-security'

export interface WebhookQueueDelivery {
  id: string
  webhookId: string
  status: 'pending' | 'success' | 'failed'
  attemptCount: number
  maxAttempts: number
  responseStatus?: number | null
  responseBody?: string | null
  nextRetrySeconds?: number | null
}

export interface WebhookQueueMessage {
  deliveryId: string
  webhookId: string
  url: string
  payload: unknown
}

export interface WebhookQueueProcessingResult {
  status: 'ok' | 'skipped'
  delivery: WebhookQueueDelivery
  queuedRetry?: { deliveryId: string, webhookId: string, url: string, payload: unknown, delaySeconds: number }
  disabledWebhookId?: string
}

export async function processWebhookDeliveryQueueMessage(
  delivery: WebhookQueueDelivery,
  message: WebhookQueueMessage,
  deliver: (message: WebhookQueueMessage) => Promise<WebhookDeliveryResult>,
): Promise<WebhookQueueProcessingResult> {
  if (delivery.status === 'success')
    return { status: 'skipped', delivery }

  const attemptCount = delivery.attemptCount + 1
  const result = await deliver(message)
  const updated: WebhookQueueDelivery = {
    ...delivery,
    attemptCount,
    responseStatus: result.status ?? null,
    responseBody: result.body ?? null,
    nextRetrySeconds: null,
  }

  if (result.success) {
    return {
      status: 'ok',
      delivery: { ...updated, status: 'success' },
    }
  }

  if (result.status === 410 || attemptCount >= delivery.maxAttempts) {
    return {
      status: 'ok',
      delivery: { ...updated, status: 'failed' },
      disabledWebhookId: message.webhookId,
    }
  }

  const delaySeconds = getWebhookRetryDelaySeconds(attemptCount, result.retryAfter, result.status ?? null)
  return {
    status: 'ok',
    delivery: { ...updated, status: 'pending', nextRetrySeconds: delaySeconds },
    queuedRetry: {
      deliveryId: message.deliveryId,
      webhookId: message.webhookId,
      url: message.url,
      payload: message.payload,
      delaySeconds,
    },
  }
}