import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloudflareSnippet } from '../src/cloudflare-snippet'

function buildRequest(path: string, body: Record<string, unknown>, colo = 'SFO') {
  const request = new Request(`https://api.codepushgo.app${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  Object.defineProperty(request, 'cf', {
    value: { colo },
  })
  return request
}

function buildCache() {
  const store = new Map<string, Response>()
  return {
    match: vi.fn(async (key: RequestInfo | URL) => {
      const url = key instanceof Request ? key.url : String(key)
      return store.get(url)?.clone()
    }),
    put: vi.fn(async (key: RequestInfo | URL, response: Response) => {
      const url = key instanceof Request ? key.url : String(key)
      store.set(url, response.clone())
    }),
    delete: vi.fn(async (key: RequestInfo | URL) => {
      const url = key instanceof Request ? key.url : String(key)
      return store.delete(url)
    }),
  }
}

describe('[Capgo parity] cloudflare plugin snippet on-prem fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('tries a fallback worker before returning a regional on-prem response', async () => {
    const cache = buildCache()
    vi.stubGlobal('caches', { default: cache })
    const body = {
      app_id: 'com.cloud.valid',
      device_id: '11111111-1111-4111-8111-111111111111',
      version_name: '0.0.0',
    }
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = new URL(url instanceof Request ? url.url : String(url))
      if (target.origin === 'https://plugin.na.codepushgo.app') {
        return new Response(JSON.stringify({ error: 'on_premise_app', message: 'On-premise app detected' }), {
          status: 429,
          headers: { 'Cache-Control': 'public, max-age=60' },
        })
      }
      if (target.origin === 'https://plugin.eu.codepushgo.app')
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      throw new Error(`Unexpected fetch target ${target.href}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await cloudflareSnippet.fetch(buildRequest('/updates', body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((fetchMock.mock.calls[0][0] as Request).url).toContain('https://plugin.na.codepushgo.app/updates')
    expect((fetchMock.mock.calls[1][0] as Request).url).toContain('https://plugin.eu.codepushgo.app/updates')
    await expect(new Response((fetchMock.mock.calls[0][0] as Request).body).json()).resolves.toEqual(body)
    await expect(new Response((fetchMock.mock.calls[1][0] as Request).body).json()).resolves.toEqual(body)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('caches on-prem only after all fallback workers agree', async () => {
    const cache = buildCache()
    vi.stubGlobal('caches', { default: cache })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'on_premise_app', message: 'On-premise app detected' }), {
      status: 429,
      headers: { 'Cache-Control': 'public, max-age=60' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await cloudflareSnippet.fetch(buildRequest('/updates', { app_id: 'com.external.app' }))

    expect(response.status).toBe(429)
    expect(response.headers.get('X-Onprem-Cached')).toBe('false')
    expect(response.headers.get('X-Onprem-App-Id')).toBe('com.external.app')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(cache.put).toHaveBeenCalledTimes(1)
  })

  it('does not finalize on-prem when fallback workers do not confirm it', async () => {
    const cache = buildCache()
    vi.stubGlobal('caches', { default: cache })
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (url instanceof Request && url.url === 'https://api.codepushgo.app/updates')
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      const target = new URL(url instanceof Request ? url.url : String(url))
      if (target.origin === 'https://plugin.na.codepushgo.app') {
        return new Response(JSON.stringify({ error: 'on_premise_app', message: 'On-premise app detected' }), {
          status: 429,
          headers: { 'Cache-Control': 'public, max-age=60' },
        })
      }
      if (target.origin === 'https://plugin.eu.codepushgo.app')
        throw new Error('fallback unavailable')
      throw new Error(`Unexpected fetch target ${target.href}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await cloudflareSnippet.fetch(buildRequest('/updates', { app_id: 'com.cloud.valid' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const putKeys = cache.put.mock.calls.map(([key]) => key instanceof Request ? key.url : String(key))
    expect(putKeys.some(key => key.includes('/__internal__/onprem-cache-v2/'))).toBe(false)
  })

  it('requires every configured fallback worker to confirm on-prem', async () => {
    const cache = buildCache()
    vi.stubGlobal('caches', { default: cache })
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (url instanceof Request && url.url === 'https://api.codepushgo.app/updates')
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      const target = new URL(url instanceof Request ? url.url : String(url))
      if (target.origin === 'https://plugin.sa.codepushgo.app' || target.origin === 'https://plugin.na.codepushgo.app') {
        return new Response(JSON.stringify({ error: 'on_premise_app', message: 'On-premise app detected' }), {
          status: 429,
          headers: { 'Cache-Control': 'public, max-age=60' },
        })
      }
      if (target.origin === 'https://plugin.eu.codepushgo.app')
        throw new Error('fallback unavailable')
      throw new Error(`Unexpected fetch target ${target.href}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await cloudflareSnippet.fetch(buildRequest('/updates', { app_id: 'com.cloud.valid' }, 'GRU'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const putKeys = cache.put.mock.calls.map(([key]) => key instanceof Request ? key.url : String(key))
    expect(putKeys.some(key => key.includes('/__internal__/onprem-cache-v2/'))).toBe(false)
  })
})
