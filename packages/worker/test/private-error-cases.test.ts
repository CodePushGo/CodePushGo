import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] private endpoint error cases', () => {
  it('rejects private stats without authorization and validates analytics bodies', async () => {
    const { app, env } = testApp()

    const missingAuth = await app.request('https://api.test/private/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appId: 'com.private.errors' }),
    }, env)
    expect(missingAuth.status).toBe(401)
    expect(await missingAuth.json()).toMatchObject({ error: 'no_jwt_apikey_or_subkey' })

    const invalidBody = await app.request('https://api.test/private/stats', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ appId: 'com.private.errors', devicesId: ['1) OR 1=1 --'] }),
    }, env)
    expect(invalidBody.status).toBe(400)
    expect(await invalidBody.json()).toMatchObject({ error: 'invalid_body' })
  })

  it('keeps private stats available to API keys', async () => {
    const { app, env, storage } = testApp()
    await storage.createApp('com.private.errors', 'Private Errors')

    const response = await app.request('https://api.test/private/stats', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ appId: 'com.private.errors' }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', data: [] })
  })

  it('rejects private upload links with missing or wrong API keys', async () => {
    const { app, env } = testApp()

    const missingAuth = await app.request('https://api.test/private/upload_link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: 'com.private.errors', version: '1.0.0' }),
    }, env)
    expect(missingAuth.status).toBe(401)
    expect(await missingAuth.json()).toMatchObject({ error: 'invalid_apikey' })

    const wrongAuth = await app.request('https://api.test/private/upload_link', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token', 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: 'com.private.errors', version: '1.0.0' }),
    }, env)
    expect(wrongAuth.status).toBe(401)
    expect(await wrongAuth.json()).toMatchObject({ error: 'invalid_apikey' })
  })

  it('validates private log_as authorization and body errors', async () => {
    const { app, env } = testApp()

    const missingAuth = await app.request('https://api.test/private/log_as', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: crypto.randomUUID() }),
    }, env)
    expect(missingAuth.status).toBe(401)
    expect(await missingAuth.json()).toMatchObject({ error: 'no_jwt_apikey_or_subkey' })

    const invalidBody = await app.request('https://api.test/private/log_as', {
      method: 'POST',
      headers: authHeaders,
      body: 'invalid json',
    }, env)
    expect(invalidBody.status).toBe(400)
    expect(await invalidBody.json()).toMatchObject({ error: 'invalid_json' })
  })

  it('returns Capgo-compatible accept_invitation errors', async () => {
    const { app, env } = testApp()

    const invalidRequest = await app.request('https://api.test/private/accept_invitation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }, env)
    expect(invalidRequest.status).toBe(400)
    expect(await invalidRequest.json()).toMatchObject({ error: 'invalid_json_body' })

    const missingInvitation = await app.request('https://api.test/private/accept_invitation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        password: 'ValidPassword123!!',
        magic_invite_string: 'missing-invitation',
        opt_for_newsletters: false,
      }),
    }, env)
    expect(missingInvitation.status).toBe(404)
    expect(await missingInvitation.json()).toMatchObject({ error: 'failed_to_accept_invitation' })
  })
})