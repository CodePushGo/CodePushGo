import { describe, expect, it } from 'vitest'
import { calculateCreditCost, GLOBAL_CREDIT_STEPS } from '../src/credits-pricing'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

interface CreditStep {
  type: string
  step_min: number
  price_per_unit: number
}

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
  return { app, env, storage }
}

describe('[Capgo parity] credits pricing API', () => {
  it.concurrent('returns the updated build_time tiers from the shared pricing table', async () => {
    const { app, env } = testApp()
    const response = await app.request('/private/credits', {}, env)

    expect(response.status).toBe(200)

    const data = await response.json() as CreditStep[]
    const buildSteps = data
      .filter(step => step.type === 'build_time')
      .sort((a, b) => a.step_min - b.step_min)

    expect(buildSteps.map(step => step.price_per_unit)).toEqual([0.16, 0.14, 0.12, 0.10, 0.09, 0.08])
  })

  it.concurrent('preserves not_authorized for org-scoped pricing queries without auth', async () => {
    const { app, env } = testApp()
    const response = await app.request('/private/credits?org_id=org-1', {}, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'not_authorized' })
  })

  it.concurrent('prices build_time overage through the shared calculator endpoint', async () => {
    const { app, env } = testApp()
    const response = await app.request('/private/credits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mau: 0, bandwidth: 0, storage: 0, build_time: 6000 }),
    }, env)

    expect(response.status).toBe(200)
    const data = await response.json() as { total_cost: number, breakdown: { build_time: { cost: number } }, usage: { build_time: number } }

    expect(data.usage.build_time).toBe(6000)
    expect(data.breakdown.build_time.cost).toBe(16)
    expect(data.total_cost).toBe(16)
  })

  it.concurrent('rejects negative build_time input', async () => {
    const { app, env } = testApp()
    const response = await app.request('/private/credits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mau: 0, bandwidth: 0, storage: 0, build_time: -60 }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_build_time' })
  })

  it.concurrent('calculates build_time tiers from the shared pricing table', () => {
    const result = calculateCreditCost({ build_time: 36000 }, GLOBAL_CREDIT_STEPS)

    expect(result.breakdown.build_time.tiers.map(tier => tier.price_per_unit)).toEqual([0.16, 0.14, 0.12, 0.10, 0.09, 0.08])
    expect(result.breakdown.build_time.cost).toBeCloseTo(84, 5)
    expect(result.total_cost).toBeCloseTo(84, 5)
  })
})
