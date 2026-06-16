import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function orgBindings(roleName = 'org_admin', orgId = 'default-org') {
  return [{ role_name: roleName, scope_type: 'org', org_id: orgId }]
}

function appBindings(appId: string, roleName = 'app_admin') {
  return [{ role_name: roleName, scope_type: 'app', org_id: 'default-org', app_id: appId }]
}

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

describe('[Capgo parity] [GET] /apikey operations', () => {
  it('lists, creates, reads, updates, and deletes API keys', async () => {
    const { app, env } = testApp()

    const emptyList = await app.request('https://api.test/apikey', { headers: authHeaders }, env)
    expect(emptyList.status).toBe(200)
    expect(await emptyList.json()).toEqual([])

    const create = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'test-key-creation', bindings: orgBindings() }),
    }, env)
    expect(create.status).toBe(200)
    const created = await create.json() as { id: number, key: string, key_hash: string, name: string }
    expect(created.name).toBe('test-key-creation')
    expect(typeof created.id).toBe('number')
    expect(created.key).toMatch(/^cpg_/)
    expect(created.key_hash).toMatch(/^[a-f0-9]{64}$/)

    const read = await app.request(`https://api.test/apikey/${created.id}`, { headers: authHeaders }, env)
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ id: created.id, key: null, name: 'test-key-creation' })

    const update = await app.request(`https://api.test/apikey/${created.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'updated-test-key-name' }),
    }, env)
    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({ id: created.id, name: 'updated-test-key-name' })

    const list = await app.request('https://api.test/apikey', { headers: authHeaders }, env)
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id, name: 'updated-test-key-name' })]))

    const remove = await app.request(`https://api.test/apikey/${created.id}`, { method: 'DELETE', headers: authHeaders }, env)
    expect(remove.status).toBe(200)
    expect(await remove.json()).toEqual({ status: 'ok' })

    const afterDelete = await app.request(`https://api.test/apikey/${created.id}`, { headers: authHeaders }, env)
    expect(afterDelete.status).toBe(404)
    expect(await afterDelete.json()).toMatchObject({ error: 'failed_to_get_apikey' })
  })

  it('returns Capgo error names for invalid create and update inputs', async () => {
    const { app, env } = testApp()

    const missingName = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    }, env)
    expect(missingName.status).toBe(400)
    expect(await missingName.json()).toMatchObject({ error: 'name_is_required' })

    const emptyName = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: '' }),
    }, env)
    expect(emptyName.status).toBe(400)
    expect(await emptyName.json()).toMatchObject({ error: 'name_is_required' })

    const invalidScope = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'bad-binding', bindings: [{ role_name: 'org_admin', scope_type: 'invalid', org_id: 'default-org' }] }),
    }, env)
    expect(invalidScope.status).toBe(400)
    expect(await invalidScope.json()).toMatchObject({ error: 'invalid_bindings' })

    const forbiddenOrg = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'bad-org', bindings: orgBindings('org_admin', 'non-existent-org') }),
    }, env)
    expect(forbiddenOrg.status).toBe(403)
    expect(await forbiddenOrg.json()).toMatchObject({ error: 'forbidden_binding' })

    const missingApp = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'bad-app', bindings: appBindings('com.example.missing') }),
    }, env)
    expect(missingApp.status).toBe(404)
    expect(await missingApp.json()).toMatchObject({ error: 'binding_failed' })

    const create = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'update-target', bindings: orgBindings() }),
    }, env)
    const created = await create.json() as { id: number }
    const unsupportedUpdate = await app.request(`https://api.test/apikey/${created.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ unsupported_field: 'invalid' }),
    }, env)
    expect(unsupportedUpdate.status).toBe(400)
    expect(await unsupportedUpdate.json()).toMatchObject({ error: 'no_valid_fields_provided_for_update' })
  })
})

describe('[Capgo parity] app-limited API key restrictions', () => {
  it('prevents app-scoped keys from managing sibling API keys', async () => {
    const { app, env } = testApp()
    const appId = 'com.example.apikey.limited'
    await createApp(app, env, appId)

    const limitedResponse = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'app-limited', bindings: appBindings(appId) }),
    }, env)
    expect(limitedResponse.status).toBe(200)
    const limited = await limitedResponse.json() as { id: number, key: string }

    const siblingResponse = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'sibling', bindings: orgBindings() }),
    }, env)
    expect(siblingResponse.status).toBe(200)
    const sibling = await siblingResponse.json() as { id: number }

    const list = await app.request('https://api.test/apikey', { headers: keyHeaders(limited.key) }, env)
    expect(list.status).toBe(401)
    expect(await list.json()).toMatchObject({ error: 'cannot_list_apikeys' })

    const create = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({ name: 'blocked', bindings: appBindings(appId) }),
    }, env)
    expect(create.status).toBe(400)
    expect(await create.json()).toMatchObject({ error: 'cannot_create_apikey' })

    const read = await app.request(`https://api.test/apikey/${sibling.id}`, { headers: keyHeaders(limited.key) }, env)
    expect(read.status).toBe(401)
    expect(await read.json()).toMatchObject({ error: 'cannot_get_apikey' })

    const update = await app.request(`https://api.test/apikey/${sibling.id}`, {
      method: 'PUT',
      headers: keyHeaders(limited.key),
      body: JSON.stringify({ name: 'blocked-update' }),
    }, env)
    expect(update.status).toBe(401)
    expect(await update.json()).toMatchObject({ error: 'cannot_update_apikey' })

    const remove = await app.request(`https://api.test/apikey/${sibling.id}`, { method: 'DELETE', headers: keyHeaders(limited.key) }, env)
    expect(remove.status).toBe(401)
    expect(await remove.json()).toMatchObject({ error: 'cannot_delete_apikey' })
  })
})
