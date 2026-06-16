import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'

describe('[Capgo parity] cloudflare plugin CORS', () => {
  it.concurrent('responds to manifest size preflight requests', async () => {
    const app = createWorkerApp(() => new MemoryStorage())
    const response = await app.request('https://api.test/updates/manifest_size', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://web.codepushgo.app',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,authorization',
      },
    }, { CODEPUSHGO_API_KEY: 'test-token' })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    const allowMethods = response.headers.get('access-control-allow-methods')?.toLowerCase()
    const allowHeaders = response.headers.get('access-control-allow-headers')?.toLowerCase()
    expect(allowMethods).toContain('options')
    expect(allowMethods).toContain('post')
    expect(allowHeaders).toContain('content-type')
    expect(allowHeaders).toContain('authorization')
  })
})
