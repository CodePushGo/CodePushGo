import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

describe('[Capgo parity] build time tracking', () => {
  const appId = 'com.test.build.time'
  const orgId = randomUUID()
  const userId = randomUUID()
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env

  let storage: MemoryStorage
  let app: ReturnType<typeof createWorkerApp>
  let writeKey = ''

  beforeEach(async () => {
    storage = new MemoryStorage()
    app = createWorkerApp(() => storage)
    await storage.createApp(appId, appId, orgId)

    const response = await app.request('/apikey', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'build-time-writer',
        bindings: [{ role_name: 'app_developer', scope_type: 'app', app_id: appId }],
      }),
    }, env)
    const body = await response.json() as { key: string }
    writeKey = body.key
  })

  it('rejects unauthenticated build time recording', async () => {
    const response = await app.request('/build/time', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, build_id: randomUUID(), platform: 'ios', build_time_unit: 30 }),
    }, env)

    expect(response.status).toBe(401)
    expect(await storage.listBuildLogsByOrg(orgId)).toHaveLength(0)
  })

  it('records iOS build time with a 2x billable multiplier', async () => {
    const buildId = randomUUID()
    const response = await app.request('/build/time', {
      method: 'POST',
      headers: { authorization: writeKey, 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, build_id: buildId, user_id: userId, platform: 'ios', build_time_unit: 600 }),
    }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as { build_log: { buildTimeUnit: number, billableSeconds: number }, daily_build_time: { buildTimeUnit: number, buildCount: number } }
    expect(body.build_log.buildTimeUnit).toBe(600)
    expect(body.build_log.billableSeconds).toBe(1200)
    expect(body.daily_build_time.buildTimeUnit).toBe(1200)
    expect(body.daily_build_time.buildCount).toBe(1)
  })

  it('records Android build time with a 1x billable multiplier', async () => {
    const buildId = randomUUID()
    const response = await app.request('/build/time', {
      method: 'POST',
      headers: { authorization: writeKey, 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, build_id: buildId, platform: 'android', build_time_unit: 150 }),
    }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as { build_log: { buildTimeUnit: number, billableSeconds: number } }
    expect(body.build_log.buildTimeUnit).toBe(150)
    expect(body.build_log.billableSeconds).toBe(150)
  })

  it('upserts duplicate build IDs instead of creating duplicate logs', async () => {
    const buildId = randomUUID()
    for (const buildTimeUnit of [600, 700]) {
      const response = await app.request('/build/time', {
        method: 'POST',
        headers: { authorization: writeKey, 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: appId, build_id: buildId, platform: 'ios', build_time_unit: buildTimeUnit }),
      }, env)
      expect(response.status).toBe(200)
    }

    const logs = await storage.listBuildLogsByOrg(orgId)
    expect(logs).toHaveLength(1)
    expect(logs[0]?.buildTimeUnit).toBe(700)
    expect(logs[0]?.billableSeconds).toBe(1400)
    const daily = await storage.getDailyBuildTime(appId, new Date().toISOString().slice(0, 10))
    expect(daily?.buildTimeUnit).toBe(1400)
    expect(daily?.buildCount).toBe(1)
  })

  it('rejects invalid platform and negative build time', async () => {
    const invalidPlatform = await app.request('/build/time', {
      method: 'POST',
      headers: { authorization: writeKey, 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, build_id: randomUUID(), platform: 'windows', build_time_unit: 30 }),
    }, env)
    expect(invalidPlatform.status).toBe(400)

    const negativeTime = await app.request('/build/time', {
      method: 'POST',
      headers: { authorization: writeKey, 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, build_id: randomUUID(), platform: 'ios', build_time_unit: -1 }),
    }, env)
    expect(negativeTime.status).toBe(400)
  })

  it('reports build time exceeded through cron org stats', async () => {
    const response = await app.request('/build/time', {
      method: 'POST',
      headers: { authorization: writeKey, 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, build_id: randomUUID(), platform: 'ios', build_time_unit: 1000 }),
    }, env)
    expect(response.status).toBe(200)

    const cron = await app.request('/triggers/cron_stat_org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId }),
    }, env)
    expect(cron.status).toBe(200)
    const body = await cron.json() as { build_time_unit: number, build_count: number, build_time_exceeded: boolean }
    expect(body.build_time_unit).toBe(2000)
    expect(body.build_count).toBe(1)
    expect(body.build_time_exceeded).toBe(true)
  })
})
