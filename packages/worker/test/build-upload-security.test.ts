import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

describe('[Capgo parity] build upload proxy security', () => {
  const appId = 'com.test.upload.security'
  const orgId = randomUUID()
  const userId = randomUUID()
  const jobId = `job-upload-${randomUUID()}`
  const builderUrl = 'https://builder.codepushgo.test'
  const builderApiKey = 'builder-secret'

  let storage: MemoryStorage
  let app: ReturnType<typeof createWorkerApp>
  let env: Env
  let writeKey = ''

  beforeEach(async () => {
    storage = new MemoryStorage()
    app = createWorkerApp(() => storage)
    env = { CODEPUSHGO_API_KEY: 'test-token', BUILDER_URL: builderUrl, BUILDER_API_KEY: builderApiKey } as Env
    await storage.createApp(appId, appId, orgId)
    await storage.createBuildRequest({ appId, ownerOrg: orgId, requestedBy: userId, platform: 'ios', buildMode: 'release', status: 'running', builderJobId: jobId })

    const response = await app.request('/apikey', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'upload-writer', bindings: [{ role_name: 'app_developer', scope_type: 'app', app_id: appId }] }),
    }, env)
    const body = await response.json() as { key: string }
    writeKey = body.key
  })

  it('rejects path traversal attempts before forwarding to builder', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    try {
      const response = await app.request(`/build/upload/${jobId}/%2e%2e%2Fjobs`, {
        method: 'PATCH',
        headers: { authorization: writeKey, 'Tus-Resumable': '1.0.0' },
      }, env)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'invalid_path', message: 'Invalid upload path' })
      expect(fetchMock).not.toHaveBeenCalled()
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('rejects invalidly encoded paths before forwarding to builder', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    try {
      const response = await app.request(`/build/upload/${jobId}/%`, {
        method: 'PATCH',
        headers: { authorization: writeKey, 'Tus-Resumable': '1.0.0' },
      }, env)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'invalid_path', message: 'Invalid upload path encoding.' })
      expect(fetchMock).not.toHaveBeenCalled()
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('does not reject canonical upload suffixes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 201,
      headers: { Location: `${builderUrl}/upload/artifact.zip` },
    }))

    try {
      const response = await app.request(`/build/upload/${jobId}/artifact.zip`, {
        method: 'PATCH',
        headers: { authorization: writeKey, 'Tus-Resumable': '1.0.0' },
      }, env)

      expect(response.status).toBe(201)
      expect(fetchMock).toHaveBeenCalledWith(`${builderUrl}/upload/artifact.zip`, expect.objectContaining({
        method: 'PATCH',
        headers: expect.any(Headers),
      }))
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect((init.headers as Headers).get('x-api-key')).toBe(builderApiKey)
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('keeps TUS resume state discoverable between PATCH chunks', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { 'Upload-Offset': '4', 'Tus-Resumable': '1.0.0' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { 'Upload-Offset': '4', 'Tus-Resumable': '1.0.0' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { 'Upload-Offset': '5', 'Tus-Resumable': '1.0.0' } }))

    try {
      const url = `/build/upload/${jobId}/artifact.zip`
      const firstPatch = await app.request(url, { method: 'PATCH', headers: { authorization: writeKey, 'Tus-Resumable': '1.0.0' } }, env)
      const head = await app.request(url, { method: 'HEAD', headers: { authorization: writeKey, 'Tus-Resumable': '1.0.0' } }, env)
      const secondPatch = await app.request(url, { method: 'PATCH', headers: { authorization: writeKey, 'Tus-Resumable': '1.0.0' } }, env)
      const methods = fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)
      const [, headInit] = fetchMock.mock.calls[1] as [string, RequestInit]

      expect(firstPatch.status).toBe(204)
      expect(firstPatch.headers.get('Upload-Offset')).toBe('4')
      expect(head.status).toBe(200)
      expect(head.headers.get('Upload-Offset')).toBe('4')
      expect(secondPatch.status).toBe(204)
      expect(secondPatch.headers.get('Upload-Offset')).toBe('5')
      expect(methods).toEqual(['PATCH', 'HEAD', 'PATCH'])
      expect(headInit).not.toHaveProperty('body')
      expect(headInit).not.toHaveProperty('duplex')
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('forwards HEAD probes to builder without a request body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 204,
      headers: { 'Upload-Offset': '5', 'Tus-Resumable': '1.0.0' },
    }))

    try {
      const response = await app.request(`/build/upload/${jobId}/artifact.zip`, {
        method: 'HEAD',
        headers: { authorization: writeKey, 'Tus-Resumable': '1.0.0' },
      }, env)
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]

      expect(response.status).toBe(204)
      expect(response.headers.get('Upload-Offset')).toBe('5')
      expect(init.method).toBe('HEAD')
      expect(init).not.toHaveProperty('body')
      expect(init).not.toHaveProperty('duplex')
    }
    finally {
      fetchMock.mockRestore()
    }
  })
})
