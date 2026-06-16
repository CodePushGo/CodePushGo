import { describe, expect, it, vi } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token', BUILDER_URL: 'https://builder.codepushgo.test', BUILDER_API_KEY: 'builder-key' } as Env
  const headers = { authorization: 'Bearer test-token', 'content-type': 'application/json' }
  return { app, env, storage, headers }
}

describe('[Capgo parity] /build/ai_analyze unsupported while native build is out of scope', () => {
  it('returns 426 upgrade_required with old-client-compatible error text', async () => {
    const { app, env, headers } = testApp()
    const response = await app.request('/build/ai_analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jobId: 'job-1', appId: 'com.test.app', logs: 'failed build log' }),
    }, env)

    expect(response.status).toBe(426)
    const body = await response.json() as { code: string, error: string, message: string }
    expect(body.code).toBe('upgrade_required')
    expect(body.error).toContain('AI build analysis is not available in CodePushGo')
    expect(body.message).toBe(body.error)
  })

  it('does not contact the builder and emits a local result event', async () => {
    const { app, env, storage, headers } = testApp()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    try {
      await app.request('/build/ai_analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId: 'job-2', appId: 'com.test.app', logs: 'failed build log' }),
      }, env)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(storage.events).toContainEqual(expect.objectContaining({
        channel: 'native-builder',
        event: 'AI Build Analysis Result',
        tags: expect.objectContaining({ result: 'upgrade_required', job_id: 'job-2', app_id: 'com.test.app' }),
      }))
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('answers 426 even when the request body is not parseable', async () => {
    const { app, env, headers } = testApp()
    const response = await app.request('/build/ai_analyze', {
      method: 'POST',
      headers,
      body: 'not-json',
    }, env)

    expect(response.status).toBe(426)
  })
})
