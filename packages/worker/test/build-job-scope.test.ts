import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const adminHeaders = {
  authorization: 'Bearer test-token',
  'content-type': 'application/json',
}

async function createScopedKey(app: ReturnType<typeof createWorkerApp>, env: Env, appId: string, roleName: string) {
  const response = await app.request('/apikey', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `test-build-job-scope-${roleName}-${randomUUID()}`,
      bindings: [
        {
          role_name: roleName,
          scope_type: 'app',
          app_id: appId,
        },
      ],
    }),
  }, env)

  expect(response.status).toBe(200)
  const data = await response.json() as { key: string }
  return data.key
}

describe('[Capgo parity] Build Endpoints Job/App Binding', () => {
  const id = randomUUID()
  const appA = `com.test.buildscope.a.${id}`
  const appB = `com.test.buildscope.b.${id}`
  const jobIdB = `job_${id.replaceAll('-', '')}`
  const orgId = randomUUID()
  const userId = randomUUID()

  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env

  let readKey = ''
  let writeKey = ''

  beforeAll(async () => {
    await storage.createApp(appA, appA, orgId)
    await storage.createApp(appB, appB, orgId)
    await storage.createBuildRequest({
      appId: appB,
      ownerOrg: orgId,
      requestedBy: userId,
      platform: 'android',
      buildMode: 'release',
      status: 'pending',
      builderJobId: jobIdB,
    })

    readKey = await createScopedKey(app, env, appA, 'app_reader')
    writeKey = await createScopedKey(app, env, appA, 'app_developer')
  })

  it.concurrent('GET /build/status denies cross-app job_id with allowed app_id', async () => {
    const url = new URL('http://localhost/build/status')
    url.searchParams.set('job_id', jobIdB)
    url.searchParams.set('app_id', appA)
    url.searchParams.set('platform', 'android')

    const response = await app.request(url.toString(), {
      method: 'GET',
      headers: {
        authorization: readKey,
        'content-type': 'application/json',
      },
    }, env)

    expect(response.status).toBe(400)
    const data = await response.json() as { error: string }
    expect(data).toHaveProperty('error', 'unauthorized')
  })

  it.concurrent('GET /build/logs/:jobId denies cross-app jobId with allowed app_id', async () => {
    const url = new URL(`http://localhost/build/logs/${jobIdB}`)
    url.searchParams.set('app_id', appA)

    const response = await app.request(url.toString(), {
      method: 'GET',
      headers: {
        authorization: readKey,
        'content-type': 'application/json',
      },
    }, env)

    expect(response.status).toBe(400)
    const data = await response.json() as { error: string }
    expect(data).toHaveProperty('error', 'unauthorized')
  })

  it.concurrent('POST /build/cancel/:jobId denies cross-app jobId with allowed app_id', async () => {
    const response = await app.request(`/build/cancel/${jobIdB}`, {
      method: 'POST',
      headers: {
        authorization: writeKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ app_id: appA }),
    }, env)

    expect(response.status).toBe(400)
    const data = await response.json() as { error: string }
    expect(data).toHaveProperty('error', 'unauthorized')
  })

  it.concurrent('POST /build/start/:jobId denies cross-app jobId with allowed app_id', async () => {
    const response = await app.request(`/build/start/${jobIdB}`, {
      method: 'POST',
      headers: {
        authorization: writeKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ app_id: appA }),
    }, env)

    expect(response.status).toBe(400)
    const data = await response.json() as { error: string }
    expect(data).toHaveProperty('error', 'unauthorized')
  })
})
