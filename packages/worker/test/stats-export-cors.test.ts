import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

describe('[OPTIONS] /private/stats/export', () => {
  it('responds to CORS preflight', async () => {
    const app = createWorkerApp(() => new MemoryStorage())
    const response = await app.request('https://api.test/private/stats/export', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,authorization',
      },
    }, { CODEPUSHGO_API_KEY: 'test-token' } as Env)

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS')
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization')
  })
})
