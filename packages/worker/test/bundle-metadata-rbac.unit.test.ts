import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function keyHeaders(key: string) {
  return { capgkey: key, 'content-type': 'application/json' }
}

async function createApp(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string) {
  const response = await app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, env)
  expect(response.status).toBe(200)
}

async function createBundle(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string, version: string) {
  const response = await app.request('https://api.test/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      app_id: appId,
      version,
      checksum: `${appId}:${version}`,
      external_url: `https://example.com/${encodeURIComponent(appId)}/${version}.zip`,
    }),
  }, env)
  expect(response.status).toBe(200)
}

async function createAppKey(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string) {
  const response = await app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `${appId}-metadata-key`,
      bindings: [{ role_name: 'app_developer', scope_type: 'app', org_id: 'default-org', app_id: appId }],
    }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { key: string }
}

describe('[Capgo parity] bundle metadata RBAC guard', () => {
  it('rejects metadata writes when the API key is scoped to another app', async () => {
    const { app, env } = testApp()
    await createApp(app, env, 'com.example.metadata.allowed')
    await createApp(app, env, 'com.example.metadata.blocked')
    await createBundle(app, env, 'com.example.metadata.blocked', '1.0.0')
    const limited = await createAppKey(app, env, 'com.example.metadata.allowed')

    const response = await app.request('https://api.test/bundle/metadata', {
      method: 'POST',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({
        app_id: 'com.example.metadata.blocked',
        version: '1.0.0',
        comment: 'blocked update',
      }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'unauthorized' })
  })

  it('allows metadata writes when the API key has app upload access', async () => {
    const { app, env } = testApp()
    await createApp(app, env, 'com.example.metadata.allowed')
    await createBundle(app, env, 'com.example.metadata.allowed', '1.0.0')
    const limited = await createAppKey(app, env, 'com.example.metadata.allowed')

    const response = await app.request('https://api.test/bundle/metadata', {
      method: 'POST',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({
        app_id: 'com.example.metadata.allowed',
        version: '1.0.0',
        comment: 'allowed update',
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
