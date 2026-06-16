import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] [POST] /app error cases', () => {
  it('returns missing_name for org app creation without a name', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ owner_org: 'default-org', app_id: 'com.app.error.missingname' }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'missing_name' })
  })

  it('returns cannot_access_organization for inaccessible organizations', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.app.error.accessdenied', name: 'Test App', owner_org: 'non-existent-org-id' }),
    }, env)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'cannot_access_organization' })
  })

  it('returns app_id_already_exists for duplicate app ids', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.app.error.duplicate', name: 'Duplicate App', owner_org: 'default-org' }),
    }, env)

    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.app.error.duplicate', name: 'Duplicate App', owner_org: 'default-org' }),
    }, env)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'app_id_already_exists' })
  })

  it('handles invalid JSON bodies', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: 'invalid json',
    }, env)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

describe('[Capgo parity] [GET] /app error cases', () => {
  it('returns cannot_access_app for inaccessible apps', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app/nonexistent.app', { headers: authHeaders }, env)
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'cannot_access_app' })
  })
})

describe('[Capgo parity] [PUT] /app error cases', () => {
  it('returns cannot_access_app for inaccessible apps', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app/nonexistent.app', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Updated Name' }),
    }, env)
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'cannot_access_app' })
  })

  it('returns cannot_update_app for unsupported update data', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.app.error.put', name: 'PUT App', owner_org: 'default-org' }),
    }, env)

    const response = await app.request('https://api.test/app/com.app.error.put', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ owner_org: 'non-existent-org-id' }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_update_app' })
  })

  it('handles invalid JSON bodies', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app/com.app.error.put', {
      method: 'PUT',
      headers: authHeaders,
      body: 'invalid json',
    }, env)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

describe('[Capgo parity] [DELETE] /app error cases', () => {
  it('returns cannot_delete_app for inaccessible apps', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app/nonexistent.app', {
      method: 'DELETE',
      headers: authHeaders,
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_delete_app' })
  })

  it('returns cannot_delete_app when deleting the same app twice', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.app.error.delete', name: 'Delete App', owner_org: 'default-org' }),
    }, env)

    const first = await app.request('https://api.test/app/com.app.error.delete', { method: 'DELETE', headers: authHeaders }, env)
    expect(first.status).toBe(200)

    const second = await app.request('https://api.test/app/com.app.error.delete', { method: 'DELETE', headers: authHeaders }, env)
    expect(second.status).toBe(400)
    expect(await second.json()).toMatchObject({ error: 'cannot_delete_app' })
  })
})
