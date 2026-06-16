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
      name: `${appId}-promote-key`,
      bindings: [{ role_name: 'app_developer', scope_type: 'app', org_id: 'default-org', app_id: appId }],
    }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { key: string }
}

describe('[Capgo parity] bundle set channel RBAC guard', () => {
  it('does not update the channel when promotion is scoped to another app', async () => {
    const { app, env } = testApp()
    await createApp(app, env, 'com.example.promote.allowed')
    await createApp(app, env, 'com.example.promote.blocked')
    await createBundle(app, env, 'com.example.promote.blocked', '1.0.0')
    const limited = await createAppKey(app, env, 'com.example.promote.allowed')

    const response = await app.request('https://api.test/bundle', {
      method: 'PUT',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({
        app_id: 'com.example.promote.blocked',
        version: '1.0.0',
        channel: 'production',
      }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'unauthorized' })
  })

  it('checks promotion permission against the target app', async () => {
    const { app, env } = testApp()
    await createApp(app, env, 'com.example.promote.allowed')
    await createBundle(app, env, 'com.example.promote.allowed', '1.0.0')
    const limited = await createAppKey(app, env, 'com.example.promote.allowed')

    const response = await app.request('https://api.test/bundle', {
      method: 'PUT',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({
        app_id: 'com.example.promote.allowed',
        version: '1.0.0',
        channel: 'production',
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
