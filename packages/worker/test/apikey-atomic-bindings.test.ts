import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function orgBinding(roleName = 'org_admin') {
  return { role_name: roleName, scope_type: 'org', org_id: 'default-org', reason: 'atomic creation test' }
}

function appBinding(appId: string, roleName = 'app_reader') {
  return { role_name: roleName, scope_type: 'app', org_id: 'default-org', app_id: appId, reason: 'atomic app binding test' }
}

async function createApp(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string) {
  const response = await app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, env)
  expect(response.status).toBe(200)
}

describe('[Capgo parity] [POST] /apikey with atomic bindings', () => {
  it('creates an API key with persisted bindings', async () => {
    const { app, env, storage } = testApp()

    const response = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'atomic-bindings-key', bindings: [orgBinding('org_member')] }),
    }, env)
    expect(response.status).toBe(200)
    const data = await response.json() as { id: number, rbac_id: string }
    expect(data.rbac_id).toBeTruthy()

    const stored = await storage.getApiKey(data.id)
    expect(stored?.bindings).toEqual([
      expect.objectContaining({ roleName: 'org_member', scopeType: 'org', orgId: 'default-org', reason: 'atomic creation test' }),
    ])
  })

  it('creates an org.create API key permission for org admin keys', async () => {
    const { app, env, storage } = testApp()

    const response = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'org-create-permission-key',
        bindings: [orgBinding('org_admin')],
        global_permissions: ['org.create'],
      }),
    }, env)
    expect(response.status).toBe(200)
    const data = await response.json() as { id: number, global_permissions: string[] }
    expect(data.global_permissions).toContain('org.create')

    const stored = await storage.getApiKey(data.id)
    expect(stored?.globalPermissions).toEqual(['org.create'])
  })

  it('rejects org.create API key permission without an org admin binding', async () => {
    const { app, env } = testApp()

    const response = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'invalid-org-create-permission-key',
        bindings: [orgBinding('org_member')],
        global_permissions: ['org.create'],
      }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_global_permissions' })
  })
})

describe('[Capgo parity] [PUT] /apikey atomic binding updates', () => {
  it('updates org.create permission from body-id editor payloads', async () => {
    const { app, env, storage } = testApp()

    const create = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'update-org-create-permission-key', bindings: [orgBinding('org_admin')] }),
    }, env)
    expect(create.status).toBe(200)
    const created = await create.json() as { id: number }

    const grant = await app.request('https://api.test/apikey', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ id: created.id, bindings: [orgBinding('org_admin')], global_permissions: ['org.create'] }),
    }, env)
    expect(grant.status).toBe(200)
    expect(await grant.json()).toMatchObject({ id: created.id, global_permissions: ['org.create'] })
    expect((await storage.getApiKey(created.id))?.globalPermissions).toEqual(['org.create'])

    const revoke = await app.request('https://api.test/apikey', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ id: created.id, bindings: [orgBinding('org_admin')], global_permissions: [] }),
    }, env)
    expect(revoke.status).toBe(200)
    expect(await revoke.json()).toMatchObject({ id: created.id, global_permissions: [] })
    expect((await storage.getApiKey(created.id))?.globalPermissions).toEqual([])
  })

  it('updates role bindings atomically for app scopes', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.example.atomic.bindings'
    await createApp(app, env, appId)

    const create = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'app-binding-target', bindings: [orgBinding('org_admin')] }),
    }, env)
    expect(create.status).toBe(200)
    const created = await create.json() as { id: number }

    const update = await app.request(`https://api.test/apikey/${created.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ bindings: [appBinding(appId)] }),
    }, env)
    expect(update.status).toBe(200)

    const stored = await storage.getApiKey(created.id)
    expect(stored?.bindings).toEqual([
      expect.objectContaining({ roleName: 'app_reader', scopeType: 'app', appId }),
    ])
  })
})
