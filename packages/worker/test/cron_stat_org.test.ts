import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

const jsonHeaders = { 'content-type': 'application/json' }

describe('[Capgo parity] cron_stat_org', () => {
  it('validates orgId before calculating org stats', async () => {
    const { app, env } = testApp()
    const response = await app.request('/triggers/cron_stat_org', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'no_orgId' })
  })

  it('calculates MAU totals and records stripe plan calculation for the org customer', async () => {
    const { app, env, storage } = testApp()
    const orgId = 'org-cron-stat-org'
    const customerId = 'cus_cron_stat_org'
    const appId = 'com.test.cron.org'
    const date = new Date().toISOString().slice(0, 10)

    await storage.upsertOrganization({ id: orgId, name: 'Cron Org', customerId })
    await storage.createApp(appId, appId, orgId)
    await storage.upsertStripeInfo({ customerId, status: 'succeeded', isGoodPlan: true })
    await storage.recordMauUsage({ appId, date, mau: 42 })

    const response = await app.request('/triggers/cron_stat_org', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ orgId }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', mau: 42, credit_only: false, credits_consumed: 0 })
    expect(Date.parse((await storage.getStripeInfoByCustomerId(customerId))?.planCalculatedAt ?? '')).toBeGreaterThan(0)
  })
})
