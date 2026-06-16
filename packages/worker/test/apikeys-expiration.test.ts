import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function orgBindings() {
  return [{ role_name: 'org_admin', scope_type: 'org', org_id: 'default-org' }]
}

function keyHeaders(key: string) {
  return { capgkey: key, 'content-type': 'application/json' }
}

async function createKey(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], extra: Record<string, unknown> = {}) {
  const response = await app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: `key-${crypto.randomUUID()}`, bindings: orgBindings(), ...extra }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { id: number, key: string, expires_at: string | null }
}

describe('[Capgo parity] [POST] /apikey expiration', () => {
  it('creates API keys with and without expiration', async () => {
    const { app, env } = testApp()
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const withExpiration = await createKey(app, env, { name: 'key-with-expiration', expires_at: futureDate })
    expect(withExpiration.expires_at).not.toBeNull()
    expect(new Date(withExpiration.expires_at as string).getTime()).toBeCloseTo(new Date(futureDate).getTime(), -3)

    const withoutExpiration = await createKey(app, env, { name: 'key-no-expiration' })
    expect(withoutExpiration.expires_at).toBeNull()
  })

  it('rejects past and invalid expiration values', async () => {
    const { app, env } = testApp()
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const past = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'past-key', bindings: orgBindings(), expires_at: pastDate }),
    }, env)
    expect(past.status).toBe(400)
    expect(await past.json()).toMatchObject({ error: 'invalid_expiration_date' })

    const invalid = await app.request('https://api.test/apikey', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'invalid-key', bindings: orgBindings(), expires_at: 'not-a-date' }),
    }, env)
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({ error: 'invalid_expiration_date' })
  })
})

describe('[Capgo parity] [PUT] /apikey/:id expiration', () => {
  it('adds, changes, and removes API key expiration', async () => {
    const { app, env } = testApp()
    const key = await createKey(app, env, { name: 'key-for-update-expiration' })

    const firstDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const add = await app.request(`https://api.test/apikey/${key.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ expires_at: firstDate }),
    }, env)
    expect(add.status).toBe(200)
    const added = await add.json() as { expires_at: string }
    expect(new Date(added.expires_at).getTime()).toBeCloseTo(new Date(firstDate).getTime(), -3)

    const secondDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const change = await app.request(`https://api.test/apikey/${key.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ expires_at: secondDate }),
    }, env)
    expect(change.status).toBe(200)
    const changed = await change.json() as { expires_at: string }
    expect(new Date(changed.expires_at).getTime()).toBeCloseTo(new Date(secondDate).getTime(), -3)

    const remove = await app.request(`https://api.test/apikey/${key.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ expires_at: null }),
    }, env)
    expect(remove.status).toBe(200)
    expect(await remove.json()).toMatchObject({ expires_at: null })
  })

  it('rejects past expiration on update and expired keys during auth', async () => {
    const { app, env, storage } = testApp()
    const key = await createKey(app, env, { name: 'expiring-key' })
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const invalidUpdate = await app.request(`https://api.test/apikey/${key.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ expires_at: pastDate }),
    }, env)
    expect(invalidUpdate.status).toBe(400)
    expect(await invalidUpdate.json()).toMatchObject({ error: 'invalid_expiration_date' })

    await storage.updateApiKey(key.id, { expiresAt: pastDate })
    const denied = await app.request('https://api.test/apikey', { headers: keyHeaders(key.key) }, env)
    expect(denied.status).toBe(401)
    expect(await denied.json()).toMatchObject({ error: 'invalid_apikey' })
  })
})

describe('[Capgo parity] [GET] /apikey expiration info', () => {
  it('includes expires_at on get and list responses', async () => {
    const { app, env } = testApp()
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const withExpiration = await createKey(app, env, { name: 'key-with-exp-get-test', expires_at: futureDate })
    const withoutExpiration = await createKey(app, env, { name: 'key-without-exp-get-test' })

    const readWith = await app.request(`https://api.test/apikey/${withExpiration.id}`, { headers: authHeaders }, env)
    expect(readWith.status).toBe(200)
    expect(await readWith.json()).toMatchObject({ id: withExpiration.id, expires_at: expect.any(String) })

    const readWithout = await app.request(`https://api.test/apikey/${withoutExpiration.id}`, { headers: authHeaders }, env)
    expect(readWithout.status).toBe(200)
    expect(await readWithout.json()).toMatchObject({ id: withoutExpiration.id, expires_at: null })

    const list = await app.request('https://api.test/apikey', { headers: authHeaders }, env)
    expect(list.status).toBe(200)
    const rows = await list.json() as Array<{ id: number, expires_at: string | null }>
    expect(rows.find((row) => row.id === withExpiration.id)?.expires_at).not.toBeNull()
    expect(rows.find((row) => row.id === withoutExpiration.id)?.expires_at).toBeNull()
  })
})
