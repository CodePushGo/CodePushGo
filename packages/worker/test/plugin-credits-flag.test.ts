import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

async function seedCreditFlagApp() {
  const ctx = testApp()
  const orgId = `org-credits-${crypto.randomUUID()}`
  const customerId = `cus_${crypto.randomUUID().replaceAll('-', '')}`
  const appId = `com.test.credits.flag.${crypto.randomUUID()}`
  await ctx.storage.upsertOrganization({ id: orgId, name: 'Credits Flag Org', customerId })
  await ctx.storage.upsertStripeInfo({ customerId, status: 'canceled', isGoodPlan: false })
  await ctx.storage.createApp(appId, appId, orgId)
  await ctx.storage.createRelease({
    appId,
    version: '1.0.1',
    platform: 'ios',
    channel: 'production',
    bytes: new TextEncoder().encode('bundle').buffer,
    checksum: 'credits-checksum',
    size: 6,
    mandatory: false,
    rollout: 100,
  })
  return { ...ctx, orgId, appId }
}

function updateBody(appId: string, deviceId = crypto.randomUUID().toLowerCase()) {
  return {
    app_id: appId,
    device_id: deviceId,
    platform: 'ios',
    version_name: '1.0.0',
  }
}

async function postUpdate(ctx: Awaited<ReturnType<typeof seedCreditFlagApp>>, deviceId?: string) {
  return ctx.app.request('https://api.test/updates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(updateBody(ctx.appId, deviceId)),
  }, ctx.env)
}

describe('[Capgo parity] plugin plan gating: credits flag', () => {
  it('blocks /updates for expired or exhausted credits and allows active credits', async () => {
    const ctx = await seedCreditFlagApp()

    const responseBlocked = await postUpdate(ctx)
    expect(responseBlocked.status).toBe(429)
    expect(await responseBlocked.json()).toMatchObject({ error: 'on_premise_app' })

    await ctx.storage.grantUsageCredits({ orgId: ctx.orgId, amount: 1, notes: 'active grant regression' })
    await ctx.storage.consumeUsageCredits({ orgId: ctx.orgId, amount: 1, reason: 'exhaust grant regression' })

    const responseExhaustedGrant = await postUpdate(ctx)
    expect(responseExhaustedGrant.status).toBe(429)
    expect(await responseExhaustedGrant.json()).toMatchObject({ error: 'on_premise_app' })

    await ctx.storage.grantUsageCredits({ orgId: ctx.orgId, amount: 1, notes: 'active grant regression' })

    const responseAllowed = await postUpdate(ctx)
    expect(responseAllowed.status).toBe(200)
  })
})
