import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

describe('[Capgo parity] credit-only billing', () => {
  it('consumes credits for a former subscriber even when legacy plan limits would not be exceeded', async () => {
    const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
    const storage = new MemoryStorage()
    const app = createWorkerApp(() => storage)
    const orgId = randomUUID()
    const customerId = `cus_${orgId}`
    const appId = 'com.test.credit.only'
    const date = new Date().toISOString().slice(0, 10)

    await storage.upsertOrganization({ id: orgId, name: 'Credit Only Org', customerId })
    await storage.createApp(appId, appId, orgId)
    await storage.grantUsageCredits({ orgId, amount: 100, notes: 'credit-only seed' })
    await storage.upsertStripeInfo({ customerId, status: 'failed', isGoodPlan: true })
    await storage.recordMauUsage({ appId, date, mau: 10 })

    const response = await app.request('/triggers/cron_stat_org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId, customerId }),
    }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as { credit_only: boolean, credits_consumed: number, mau: number }
    expect(body.credit_only).toBe(true)
    expect(body.mau).toBe(10)
    expect(body.credits_consumed).toBe(10)

    const balance = await storage.getUsageCreditBalance(orgId)
    expect(balance?.usedCredits).toBe(10)
    expect(balance?.availableCredits).toBe(90)

    const overageEvents = await storage.listUsageOverageEvents(orgId)
    expect(overageEvents).toHaveLength(1)
    expect(overageEvents[0]).toMatchObject({
      metric: 'mau',
      overageAmount: 10,
      creditsConsumed: 10,
      details: { limit: 0, usage: 10 },
    })

    expect(await storage.getStripeInfoByCustomerId(customerId)).toMatchObject({
      status: 'failed',
      isGoodPlan: true,
    })
  })

  it('does not consume credits for active subscribers', async () => {
    const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
    const storage = new MemoryStorage()
    const app = createWorkerApp(() => storage)
    const orgId = randomUUID()
    const customerId = `cus_${orgId}`
    const appId = 'com.test.credit.active'
    const date = new Date().toISOString().slice(0, 10)

    await storage.upsertOrganization({ id: orgId, name: 'Active Org', customerId })
    await storage.createApp(appId, appId, orgId)
    await storage.grantUsageCredits({ orgId, amount: 100 })
    await storage.upsertStripeInfo({ customerId, status: 'succeeded', isGoodPlan: true })
    await storage.recordMauUsage({ appId, date, mau: 10 })

    const response = await app.request('/triggers/cron_stat_org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId, customerId }),
    }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as { credit_only: boolean, credits_consumed: number }
    expect(body.credit_only).toBe(false)
    expect(body.credits_consumed).toBe(0)
    expect((await storage.getUsageCreditBalance(orgId))?.usedCredits).toBe(0)
    expect(await storage.listUsageOverageEvents(orgId)).toHaveLength(0)
  })
})
