import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function keyHeaders(key: string) {
  return { authorization: key, 'content-type': 'application/json' }
}

describe('[Capgo parity] RBAC permission system', () => {
  it('allows app-scoped API keys to manage their own app channels only', async () => {
    const { app, env, storage } = testApp()
    const allowedAppId = 'com.rbac.allowed'
    const blockedAppId = 'com.rbac.blocked'

    await storage.createApp(allowedAppId, allowedAppId, 'default-org')
    await storage.createApp(blockedAppId, blockedAppId, 'default-org')

    const createKey = await app.request('/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'rbac-app-admin',
        bindings: [{ role_name: 'app_admin', scope_type: 'app', org_id: 'default-org', app_id: allowedAppId }],
      }),
    }, env)
    expect(createKey.status).toBe(200)
    const key = (await createKey.json() as { key: string }).key

    const allowed = await app.request('/channel', {
      method: 'POST',
      headers: keyHeaders(key),
      body: JSON.stringify({ app_id: allowedAppId, channel: 'preview', public: false }),
    }, env)
    expect(allowed.status).toBe(200)

    const blocked = await app.request('/channel', {
      method: 'POST',
      headers: keyHeaders(key),
      body: JSON.stringify({ app_id: blockedAppId, channel: 'preview', public: false }),
    }, env)
    expect(blocked.status).toBe(400)
    expect(await blocked.json()).toMatchObject({ error: 'unauthorized' })
  })

  it('keeps API-key management restricted for app-scoped keys', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.rbac.apikey.manage'

    await storage.createApp(appId, appId, 'default-org')

    const createKey = await app.request('/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'rbac-app-reader',
        bindings: [{ role_name: 'app_reader', scope_type: 'app', org_id: 'default-org', app_id: appId }],
      }),
    }, env)
    expect(createKey.status).toBe(200)
    const key = (await createKey.json() as { key: string }).key

    const list = await app.request('/apikey', { headers: keyHeaders(key) }, env)
    expect(list.status).toBe(401)
    expect(await list.json()).toMatchObject({ error: 'cannot_list_apikeys' })
  })
})
