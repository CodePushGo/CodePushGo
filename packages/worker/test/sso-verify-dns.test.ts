import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] [POST] /private/sso/verify-dns', () => {
  it('returns 404 for non-existent provider', async () => {
    const { app, env } = testApp()

    const response = await app.request('/private/sso/verify-dns', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ provider_id: crypto.randomUUID() }),
    }, env)

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: 'provider_not_found' })
  })

  it('returns 401 without authentication', async () => {
    const { app, env } = testApp()

    const response = await app.request('/private/sso/verify-dns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider_id: crypto.randomUUID() }),
    }, env)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'no_jwt_apikey_or_subkey' })
  })

  it('returns verification state for an existing provider', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertSsoProvider({ providerId: 'provider-123', orgId: 'org-123', domain: 'managed.example' })

    const response = await app.request('/private/sso/verify-dns', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ provider_id: 'provider-123' }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', provider_id: 'provider-123', domain: 'managed.example', verified: true })
  })
})
