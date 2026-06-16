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

describe('[Capgo parity] /build/ai_analyze_stream unsupported while native build is out of scope', () => {
  it('returns 426 JSON instead of opening a stream when AI native-build analysis is unavailable', async () => {
    const { app, env, headers } = testApp()
    const response = await app.request('/build/ai_analyze_stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jobId: 'job-stream-1', appId: 'com.test.app', logs: 'failed build log' }),
    }, env)

    expect(response.status).toBe(426)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toMatchObject({
      code: 'upgrade_required',
      error: expect.stringContaining('AI build analysis is not available in CodePushGo'),
    })
  })

  it('does not claim/refund or contact the builder', async () => {
    const { app, env, storage, headers } = testApp()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('event: done\n\n', { headers: { 'content-type': 'text/event-stream' } }))

    try {
      await app.request('/build/ai_analyze_stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId: 'job-stream-2', appId: 'com.test.app', logs: 'failed build log' }),
      }, env)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(storage.events).toContainEqual(expect.objectContaining({
        event: 'AI Build Analysis Result',
        tags: expect.objectContaining({ result: 'upgrade_required', job_id: 'job-stream-2', app_id: 'com.test.app' }),
      }))
    }
    finally {
      fetchMock.mockRestore()
    }
  })
})
