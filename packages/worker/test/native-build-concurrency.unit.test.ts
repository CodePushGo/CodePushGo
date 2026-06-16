import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { testApp } from './helpers'

describe('[Capgo parity] native build concurrency disabled for React Native scope', () => {
  it('does not reserve or start native build work when builder support is not configured', async () => {
    const { app, env, storage } = testApp()
    const orgId = randomUUID()
    const appId = 'com.test.native.disabled.concurrency'

    await storage.createApp(appId, appId, orgId)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    try {
      const response = await app.request('/build/request', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: appId, platform: 'ios' }),
      }, env)

      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ error: 'service_unavailable' })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(await storage.getBuildRequestByJobId('job-native-build-concurrency')).toBeUndefined()
    }
    finally {
      fetchMock.mockRestore()
    }
  })
})
