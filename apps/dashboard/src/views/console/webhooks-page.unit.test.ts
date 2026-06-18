import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/router.ts'), 'utf8')
const tabsSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/constants/consoleTabs.ts'), 'utf8')
const pageSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/views/console/ConsoleOrganizationWebhooksPage.vue'), 'utf8')
const serviceSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/services/webhooks.ts'), 'utf8')

describe('[Capgo parity] organization webhooks console surface', () => {
  it('mounts webhooks as a dedicated organization settings route and tab', () => {
    expect(routerSource).toContain('ConsoleOrganizationWebhooksPage')
    expect(routerSource).toContain("{ path: 'organization/webhooks', component: ConsoleOrganizationWebhooksPage }")
    expect(tabsSource).toContain("{ label: 'Webhooks', key: '/settings/organization/webhooks', icon: Webhook }")
  })

  it('keeps the Capgo webhook page behaviors on the CodePushGo Worker API', () => {
    expect(pageSource).toContain('WEBHOOK_EVENT_TYPES')
    expect(pageSource).toContain('createWebhook')
    expect(pageSource).toContain('updateWebhook')
    expect(pageSource).toContain('deleteWorkerWebhook')
    expect(pageSource).toContain('testWorkerWebhook')
    expect(pageSource).toContain('fetchWebhookDeliveries')
    expect(pageSource).toContain('retryWebhookDelivery')
    expect(pageSource).toContain('signatureVerificationCode')
    expect(pageSource).toContain('aria-label="Webhook delivery log"')
  })

  it('uses Worker routes instead of Supabase Edge Functions', () => {
    expect(serviceSource).toContain("buildWebhookApiPath('/webhooks'")
    expect(serviceSource).toContain("buildWebhookApiPath('/webhooks/test'")
    expect(serviceSource).toContain("buildWebhookApiPath('/webhooks/deliveries'")
    expect(serviceSource).toContain("buildWebhookApiPath('/webhooks/deliveries/retry'")
    expect(serviceSource).toContain('authorization: `Bearer ${apiKey}`')
    expect(serviceSource).not.toContain('functions.invoke')
    expect(serviceSource).not.toContain('supabase/functions')
  })
})
