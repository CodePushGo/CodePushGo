import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const originalCaches = globalThis.caches
const cachedBodiesByPath = new Map([
  ['/read/attachments/orgs/test-org/apps/test-app/orphan.txt', 'cached orphan bytes'],
  ['/read/attachments/orgs/test-org/apps/test-app/', 'cached malformed bytes'],
])

describe('[Capgo parity] files app-scoped cached reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      writable: true,
      value: {
        default: {
          match: async (request: Request) => {
            const pathname = new URL(request.url).pathname
            const body = cachedBodiesByPath.get(pathname)
            return body == null
              ? null
              : new Response(body, { headers: { 'content-type': 'text/plain' } })
          },
        },
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      writable: true,
      value: originalCaches,
    })
  })

  it('serves deleted app-scoped files from cache without a storage lookup', async () => {
    const storageFactory = vi.fn(() => new MemoryStorage())
    const app = createWorkerApp(storageFactory)

    const response = await app.request('http://localhost/read/attachments/orgs/test-org/apps/test-app/orphan.txt', {}, {} as Env)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-CodePushGo-Cache')).toBe('hit')
    expect(await response.text()).toBe('cached orphan bytes')
    expect(storageFactory).not.toHaveBeenCalled()
  })

  it('serves malformed app-scoped paths from cache without a storage lookup', async () => {
    const storageFactory = vi.fn(() => new MemoryStorage())
    const app = createWorkerApp(storageFactory)

    const response = await app.request('http://localhost/read/attachments/orgs/test-org/apps/test-app/', {}, {} as Env)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-CodePushGo-Cache')).toBe('hit')
    expect(await response.text()).toBe('cached malformed bytes')
    expect(storageFactory).not.toHaveBeenCalled()
  })
})
