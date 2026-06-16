import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

const jsonHeaders = { 'content-type': 'application/json' }

describe('[Capgo parity] cron stat integration', () => {
  it('runs app refresh then org plan calculation for the same React Native app id', async () => {
    const { app, env, storage } = testApp()
    const orgId = 'org-cron-stat-integration'
    const customerId = 'cus_cron_stat_integration'
    const appId = 'com.test.reactnative.cron'

    await storage.upsertOrganization({ id: orgId, name: 'Cron Integration Org', customerId })
    await storage.createApp(appId, appId, orgId)
    await storage.upsertStripeInfo({ customerId, status: 'succeeded', isGoodPlan: true })

    const appResponse = await app.request('/triggers/cron_stat_app', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ appId, orgId }),
    }, env)
    expect(appResponse.status).toBe(200)
    expect(await appResponse.json()).toEqual({ status: 'Stats saved' })

    const orgResponse = await app.request('/triggers/cron_stat_org', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ orgId, customerId }),
    }, env)
    expect(orgResponse.status).toBe(200)

    expect((await storage.getApp(appId))?.statsUpdatedAt).toBeTruthy()
    expect((await storage.getOrganization(orgId))?.statsUpdatedAt).toBeTruthy()
    expect((await storage.getStripeInfoByCustomerId(customerId))?.planCalculatedAt).toBeTruthy()
  })
})
