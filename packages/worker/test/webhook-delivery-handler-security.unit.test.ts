import { describe, expect, it } from 'vitest'
import { invalidWebhookDeliveryLog, webhookDeliveryReceivedLog, webhookFailureNotificationData } from '../src/webhook-delivery-security'

const sensitiveUrl = 'https://example.com/hooks/codepushgo?token=secret-token'
const payload = {
  type: 'releases.INSERT',
  event: 'releases.INSERT',
  event_id: 'event-sensitive-url',
  org_id: 'org-1',
}

function serialized(value: unknown) {
  return JSON.stringify(value)
}

describe('[Capgo parity] webhook delivery handler security', () => {
  it('does not log raw queue webhook URLs or query secrets', () => {
    const log = webhookDeliveryReceivedLog({
      delivery_id: 'delivery-1',
      webhook_id: 'webhook-1',
      url: sensitiveUrl,
      payload,
    })

    expect(log).toMatchObject({
      deliveryId: 'delivery-1',
      webhookId: 'webhook-1',
      urlInfo: {
        valid: true,
        protocol: 'https',
        hostnameLength: 'example.com'.length,
        pathSegmentCount: 2,
        hasQuery: true,
        hasCredentials: false,
      },
    })
    expect(log).not.toHaveProperty('url')
    expect(serialized(log)).not.toContain('secret-token')
  })

  it('does not dump raw delivery data when queue payload validation fails', () => {
    const log = invalidWebhookDeliveryLog({
      delivery_id: 'delivery-2',
      webhook_id: 'webhook-1',
      url: sensitiveUrl,
    })

    expect(log).toMatchObject({
      hasDeliveryId: true,
      hasWebhookId: true,
      hasUrl: true,
      hasPayload: false,
      urlInfo: {
        valid: true,
        hasQuery: true,
      },
    })
    expect(log).not.toHaveProperty('deliveryData')
    expect(serialized(log)).not.toContain('secret-token')
  })

  it('does not send raw webhook URLs to failure notifications', () => {
    const eventData = webhookFailureNotificationData({
      webhookName: 'Sensitive webhook',
      webhookId: 'webhook-1',
      url: sensitiveUrl,
    })

    expect(eventData).toMatchObject({
      webhook_name: 'Sensitive webhook',
      webhook_id: 'webhook-1',
      webhook_url_info: {
        valid: true,
        protocol: 'https',
        hostnameLength: 'example.com'.length,
        pathSegmentCount: 2,
        hasQuery: true,
        hasCredentials: false,
      },
    })
    expect(eventData).not.toHaveProperty('webhook_url')
    expect(serialized(eventData)).not.toContain('secret-token')
  })
})