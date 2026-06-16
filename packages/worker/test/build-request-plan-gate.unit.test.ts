import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

describe('[Capgo parity] native build request plan gate', () => {
  const appId = 'com.test.native.build.plan'
  const orgId = randomUUID()
  const userId = randomUUID()
  const env = { CODEPUSHGO_API_KEY: 'test-token', BUILDER_URL: 'https://builder.codepushgo.test', BUILDER_API_KEY: 'builder-secret' } as Env

  let storage: MemoryStorage
  let app: ReturnType<typeof createWorkerApp>
  let writeKey = ''

  beforeEach(async () => {
    storage = new MemoryStorage()
    app = createWorkerApp(() => storage)
    await storage.createApp(appId, appId, orgId)
    await storage.recordBuildTime({
      orgId,
      userId,
      buildId: randomUUID(),
      platform: 'ios',
      buildTimeUnit: 1000,
      appId,
    })

    const response = await app.request('/apikey', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'native-build-plan-gate', bindings: [{ role_name: 'app_developer', scope_type: 'app', app_id: appId }] }),
    }, env)
    expect(response.status).toBe(200)
    const body = await response.json() as { key: string }
    writeKey = body.key
  })

  it('blocks builder job creation when build time action is over plan', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))

    try {
      const response = await app.request('/build/request', {
        method: 'POST',
        headers: { authorization: writeKey, 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: appId, platform: 'ios' }),
      }, env)

      expect(response.status).toBe(429)
      expect(await response.json()).toMatchObject({
        error: 'need_plan_upgrade',
        message: 'Cannot request native build, upgrade plan to continue to build',
        moreInfo: {
          app_id: appId,
          org_id: orgId,
          reason: 'build_time',
        },
      })
      expect(fetchMock).not.toHaveBeenCalled()
    }
    finally {
      fetchMock.mockRestore()
    }
  })
})
