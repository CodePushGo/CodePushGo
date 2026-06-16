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

async function createAppKey(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string) {
  const response = await app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `${appId}-upload-key`,
      bindings: [{ role_name: 'app_developer', scope_type: 'app', org_id: 'default-org', app_id: appId }],
    }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { key: string }
}

describe('[Capgo parity] files upload auth', () => {
  it('checks upload_link API keys against primary app-scoped auth before issuing upload URLs', async () => {
    const { app, env } = testApp()
    await createApp(app, env, 'com.files.upload.allowed')
    await createApp(app, env, 'com.files.upload.blocked')
    const limited = await createAppKey(app, env, 'com.files.upload.allowed')

    const allowed = await app.request('https://api.test/upload_link', {
      method: 'POST',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({ app_id: 'com.files.upload.allowed', name: '1.0.0' }),
    }, env)
    expect(allowed.status).toBe(200)
    await expect(allowed.json()).resolves.toMatchObject({ status: 'ok' })

    const blocked = await app.request('https://api.test/upload_link', {
      method: 'POST',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({ app_id: 'com.files.upload.blocked', name: '1.0.0' }),
    }, env)
    expect(blocked.status).toBe(400)
    await expect(blocked.json()).resolves.toMatchObject({ error: 'unauthorized' })
  })
})
