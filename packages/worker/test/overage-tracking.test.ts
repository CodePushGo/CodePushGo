import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../src/storage'

function cycleDetails(start: string, end: string, details: Record<string, unknown> = {}) {
  return {
    billingCycleStart: new Date(start).toISOString(),
    billingCycleEnd: new Date(end).toISOString(),
    ...details,
  }
}

async function seededStorage(orgId: string, credits = 1000) {
  const storage = new MemoryStorage()
  await storage.upsertOrganization({ id: orgId, name: 'Overage Org' })
  await storage.grantUsageCredits({ orgId, amount: credits })
  return storage
}

describe('[Capgo parity] overage Tracking - Duplicate Prevention', () => {
  it('does not create duplicate overage records when called multiple times with same values', async () => {
    const orgId = crypto.randomUUID()
    const storage = await seededStorage(orgId)
    const details = cycleDetails('2025-10-07', '2025-11-07', { limit: 53687091200, usage: 53850157488 })

    for (let index = 0; index < 5; index++) {
      const result = await storage.consumeUsageCredits({
        orgId,
        amount: 25,
        metric: 'bandwidth',
        overageAmount: 163066288,
        details,
      })
      expect(result?.overageEvent).toBeDefined()
    }

    const events = await storage.listUsageOverageEvents(orgId)
    expect(events.filter(event => event.metric === 'bandwidth')).toHaveLength(1)
    expect((await storage.getUsageCreditBalance(orgId))?.usedCredits).toBe(25)
  })

  it('creates new record when overage amount increases significantly', async () => {
    const orgId = crypto.randomUUID()
    const storage = await seededStorage(orgId)
    const details = cycleDetails('2025-12-07', '2026-01-07', { limit: 10000000 })

    await storage.consumeUsageCredits({ orgId, amount: 10, metric: 'storage', overageAmount: 1000000, details: { ...details, usage: 11000000 } })
    await storage.consumeUsageCredits({ orgId, amount: 20, metric: 'storage', overageAmount: 2000000, details: { ...details, usage: 12000000 } })

    const events = await storage.listUsageOverageEvents(orgId)
    expect(events.filter(event => event.metric === 'storage')).toHaveLength(2)
  })

  it('creates one record when credits become available and skips the repeated call', async () => {
    const orgId = crypto.randomUUID()
    const storage = await seededStorage(orgId, 100)
    const details = cycleDetails('2025-12-01', '2026-01-01', { limit: 5000, usage: 15000 })

    const firstResult = await storage.consumeUsageCredits({ orgId, amount: 10, metric: 'mau', overageAmount: 10000, details })
    expect(firstResult?.overageEvent?.creditsConsumed).toBeGreaterThan(0)

    await storage.consumeUsageCredits({ orgId, amount: 10, metric: 'mau', overageAmount: 10000, details })

    const events = await storage.listUsageOverageEvents(orgId)
    expect(events.filter(event => event.metric === 'mau')).toHaveLength(1)
    expect((await storage.getUsageCreditBalance(orgId))?.usedCredits).toBe(10)
  })

  it('does not create record when overage increases by less than 1%', async () => {
    const orgId = crypto.randomUUID()
    const storage = await seededStorage(orgId)
    const details = cycleDetails('2025-11-01', '2025-12-01', { limit: 1000000 })

    await storage.consumeUsageCredits({ orgId, amount: 10, metric: 'build_time', overageAmount: 100000, details: { ...details, usage: 1100000 } })
    await storage.consumeUsageCredits({ orgId, amount: 11, metric: 'build_time', overageAmount: 100500, details: { ...details, usage: 1100500 } })

    const events = await storage.listUsageOverageEvents(orgId)
    expect(events.filter(event => event.metric === 'build_time')).toHaveLength(1)
    expect((await storage.getUsageCreditBalance(orgId))?.usedCredits).toBe(10)
  })
})
