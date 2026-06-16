import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/storage'

const sendEventToTrackingMock = vi.hoisted(() => vi.fn())

vi.mock('../src/tracking', () => ({
  sendEventToTracking: sendEventToTrackingMock,
}))

const { createWorkerApp, MemoryStorage } = await import('../src/index')

function decodeBase64Url(value: string) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
  return new Uint8Array([...binary].map(char => char.charCodeAt(0)))
}

async function verifyHs256(jwt: string, secret: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.')
  expect(encodedHeader).toBeTruthy()
  expect(encodedPayload).toBeTruthy()
  expect(encodedSignature).toBeTruthy()

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )
  expect(verified).toBe(true)

  return {
    header: JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedHeader))) as Record<string, unknown>,
    payload: JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as Record<string, unknown>,
  }
}

describe('[Capgo parity] build start direct log token', () => {
  const appId = 'com.test.build.logs'
  const jobId = `job-log-token-${randomUUID()}`
  const orgId = randomUUID()
  const userId = randomUUID()
  const jwtSecret = 'super-secret-jwt-key'
  const publicUrl = 'https://api.codepushgo.test'
  const builderUrl = 'https://builder.codepushgo.test'
  const builderApiKey = 'builder-api-key'

  let storage: MemoryStorage
  let app: ReturnType<typeof createWorkerApp>
  let env: Env
  let writeKey = ''

  beforeEach(async () => {
    sendEventToTrackingMock.mockReset()
    sendEventToTrackingMock.mockResolvedValue(undefined)

    storage = new MemoryStorage()
    app = createWorkerApp(() => storage)
    env = {
      CODEPUSHGO_API_KEY: 'test-token',
      BUILDER_URL: builderUrl,
      BUILDER_API_KEY: builderApiKey,
      JWT_SECRET: jwtSecret,
      PUBLIC_URL: publicUrl,
    } as Env

    await storage.createApp(appId, appId, orgId)
    await storage.createBuildRequest({
      appId,
      ownerOrg: orgId,
      requestedBy: userId,
      platform: 'ios',
      buildMode: 'release',
      status: 'pending',
      builderJobId: jobId,
    })

    const response = await app.request('/apikey', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'test-build-start-log-token',
        bindings: [{ role_name: 'app_developer', scope_type: 'app', app_id: appId }],
      }),
    }, env)
    const body = await response.json() as { key: string }
    writeKey = body.key
  })

  it('returns a verifiable direct log token for the builder', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'running',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    try {
      const response = await app.request(`/build/start/${jobId}`, {
        method: 'POST',
        headers: {
          authorization: writeKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ app_id: appId }),
      }, env)

      expect(response.status).toBe(200)
      const body = await response.json() as { status: string, job_id: string, logs_url?: string, logs_token?: string }
      expect(body.status).toBe('running')
      expect(body.job_id).toBe(jobId)
      expect(body.logs_url).toBe(`${publicUrl}/build_logs_direct/${jobId}`)
      expect(body.logs_token).toBeTruthy()

      const verification = await verifyHs256(body.logs_token!, jwtSecret)
      expect(verification.header).toMatchObject({ alg: 'HS256', typ: 'JWT' })
      expect(verification.payload).toMatchObject({
        iss: 'capgo',
        aud: 'build-logs',
        sub: userId,
        job_id: jobId,
        app_id: appId,
      })
      expect(typeof verification.payload.iat).toBe('number')
      expect(typeof verification.payload.exp).toBe('number')
      expect(verification.payload.exp as number).toBeGreaterThan(verification.payload.iat as number)

      expect(fetchMock).toHaveBeenCalledWith(`${builderUrl}/jobs/${encodeURIComponent(jobId)}/start`, {
        method: 'POST',
        headers: { 'x-api-key': builderApiKey },
      })
      expect(sendEventToTrackingMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'Build Started' }),
      )
    }
    finally {
      fetchMock.mockRestore()
    }
  })

  it('emits Build Failed when the builder rejects the start request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('builder is offline', { status: 500 }))

    try {
      const response = await app.request(`/build/start/${jobId}`, {
        method: 'POST',
        headers: {
          authorization: writeKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ app_id: appId }),
      }, env)

      expect(response.status).toBe(502)
      expect(sendEventToTrackingMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event: 'Build Failed',
          tags: expect.objectContaining({
            app_id: appId,
            platform: 'ios',
            build_mode: 'release',
            failure_category: expect.any(String),
          }),
        }),
      )
    }
    finally {
      fetchMock.mockRestore()
    }
  })
})
