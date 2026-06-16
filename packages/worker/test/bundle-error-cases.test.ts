import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

async function seedAppWithBundle() {
  const ctx = testApp()
  await ctx.app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: 'com.bundle.error.case', name: 'Bundle Error App', owner_org: 'default-org' }),
  }, ctx.env)
  await ctx.app.request('https://api.test/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      app_id: 'com.bundle.error.case',
      version: '1.0.0',
      checksum: 'abc123',
      external_url: 'https://example.com/bundle.zip',
    }),
  }, ctx.env)
  return ctx
}

describe('[Capgo parity] [GET] /bundle error cases', () => {
  it('returns missing_app_id when app_id is missing', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle', { headers: authHeaders }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'missing_app_id' })
  })

  it('returns cannot_get_bundle when app is inaccessible', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle?app_id=nonexistent.app', { headers: authHeaders }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_get_bundle' })
  })

  it('handles invalid JSON bodies on create', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: 'invalid json',
    }, env)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

describe('[Capgo parity] [DELETE] /bundle error cases', () => {
  it('returns missing_app_id when app_id is missing', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ version: '1.0.0' }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'missing_app_id' })
  })

  it('returns cannot_delete_bundle when app is inaccessible', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'nonexistent.app', version: '1.0.0' }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_delete_bundle' })
  })

  it('returns cannot_delete_version when version cannot be deleted', async () => {
    const { app, env } = await seedAppWithBundle()
    const response = await app.request('https://api.test/bundle', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.bundle.error.case', version: 'nonexistent-version' }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_delete_version' })
  })

  it('handles invalid JSON bodies on delete', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle', {
      method: 'DELETE',
      headers: authHeaders,
      body: 'invalid json',
    }, env)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

describe('[Capgo parity] [POST] /bundle/metadata error cases', () => {
  it('returns no_fields_to_update when no update fields are provided', async () => {
    const { app, env } = await seedAppWithBundle()
    const response = await app.request('https://api.test/bundle/metadata', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.bundle.error.case', version_id: 1 }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'no_fields_to_update' })
  })

  it('returns cannot_find_version when metadata target is missing', async () => {
    const { app, env } = await seedAppWithBundle()
    const response = await app.request('https://api.test/bundle/metadata', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.bundle.error.case', version_id: 999999, link: 'https://example.com' }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_find_version' })
  })

  it('handles invalid JSON bodies on metadata updates', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle/metadata', {
      method: 'POST',
      headers: authHeaders,
      body: 'invalid json',
    }, env)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

describe('[Capgo parity] [PUT] /bundle error cases', () => {
  it('returns cannot_access_app when app is inaccessible', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'nonexistent.app', version_id: 1, channel_id: 1 }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_access_app' })
  })

  it('returns cannot_find_version when the bundle cannot be found', async () => {
    const { app, env } = await seedAppWithBundle()
    const response = await app.request('https://api.test/bundle', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.bundle.error.case', version_id: 999999, channel_id: 1 }),
    }, env)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_find_version' })
  })

  it('handles invalid JSON bodies on set-channel updates', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/bundle', {
      method: 'PUT',
      headers: authHeaders,
      body: 'invalid json',
    }, env)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
