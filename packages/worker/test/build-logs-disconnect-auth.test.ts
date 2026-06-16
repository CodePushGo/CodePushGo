import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

describe('[Capgo parity] build log disconnect authorization', () => {
  const appId = 'com.test.build.logs.disconnect'
  const orgId = randomUUID()
  const userId = randomUUID()
  const jobId = `job-logs-${randomUUID()}`
  const builderUrl = 'https://builder.codepushgo.test'
  const builderApiKey = 'builder-api-key'

  let storage: MemoryStorage
  let app: ReturnType<typeof createWorkerApp>
  let env: Env
  let readKey = ''
  let writeKey = ''

  async function createScopedKey(roleName: string) {
    const response = await app.request('/apikey', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ name: `logs-${roleName}`, bindings: [{ role_name: roleName, scope_type: 'app', app_id: appId }] }),
    }, env)
    expect(response.status).toBe(200)
    const body = await response.json() as { key: string }
    return body.key
  }

  beforeEach(async () => {
    storage = new MemoryStorage()
    app = createWorkerApp(() => storage)
    env = { CODEPUSHGO_API_KEY: 'test-token', BUILDER_URL: builderUrl, BUILDER_API_KEY: builderApiKey } as Env
    await storage.createApp(appId, appId, orgId)
    await storage.createBuildRequest({ appId, ownerOrg: orgId, requestedBy: userId, platform: 'ios', buildMode: 'release', status: 'running', builderJobId: jobId })
    readKey = await createScopedKey('app_reader')
    writeKey = await createScopedKey('app_developer')
  })

  it('does not cancel the build when a read-only caller disconnects', async () => {
    const controller = new AbortController()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === `${builderUrl}/jobs/${encodeURIComponent(jobId)}/logs`) {
        return new Response('data: log line\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      const response = await app.request(`/build/logs/${jobId}?app_id=${appId}`, {
        method: 'GET',
        headers: { authorization: readKey },
        signal: controller.signal,
      }, env)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      controller.abort()
      await Promise.resolve()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('cancels the build on disconnect when the caller can build natively', async () => {
    const controller = new AbortController()
    let resolveCancelObserved: () => void = () => {
      throw new Error('Cancel observer not initialized')
    }
    const cancelObserved = new Promise<void>((resolve) => {
      resolveCancelObserved = resolve
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === `${builderUrl}/jobs/${encodeURIComponent(jobId)}/logs`) {
        return new Response('data: log line\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }
      if (url === `${builderUrl}/jobs/${encodeURIComponent(jobId)}/cancel`) {
        resolveCancelObserved()
        expect(init).toMatchObject({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': builderApiKey,
          },
          body: JSON.stringify({ app_id: appId }),
        })
        return new Response(JSON.stringify({ status: 'cancelled' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      const response = await app.request(`/build/logs/${jobId}?app_id=${appId}`, {
        method: 'GET',
        headers: { authorization: writeKey },
        signal: controller.signal,
      }, env)

      expect(response.status).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      controller.abort()
      await cancelObserved
      expect(fetchMock).toHaveBeenCalledTimes(2)
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('cancels immediately when an authorized request already aborted before listener registration', async () => {
    const controller = new AbortController()
    controller.abort()
    let resolveCancelObserved: () => void = () => {
      throw new Error('Cancel observer not initialized')
    }
    const cancelObserved = new Promise<void>((resolve) => {
      resolveCancelObserved = resolve
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === `${builderUrl}/jobs/${encodeURIComponent(jobId)}/logs`) {
        return new Response('data: log line\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }
      if (url === `${builderUrl}/jobs/${encodeURIComponent(jobId)}/cancel`) {
        resolveCancelObserved()
        expect(init).toMatchObject({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': builderApiKey,
          },
          body: JSON.stringify({ app_id: appId }),
        })
        return new Response(JSON.stringify({ status: 'cancelled' }), { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      const response = await app.request(`/build/logs/${jobId}?app_id=${appId}`, {
        method: 'GET',
        headers: { authorization: writeKey },
        signal: controller.signal,
      }, env)

      expect(response.status).toBe(200)
      await cancelObserved
      expect(fetchMock).toHaveBeenCalledTimes(2)
    }
    finally {
      fetchMock.mockRestore()
    }
  })
})
