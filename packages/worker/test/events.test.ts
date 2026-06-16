import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] [POST] /private/events operations', () => {
  it('tracks events with an API key', async () => {
    const { app, env, storage } = testApp()
    const response = await app.request('https://api.test/private/events', {
      method: 'POST',
      headers: { capgkey: 'test-token', 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'test',
        event: 'test_event',
        description: 'Testing event tracking',
        notify: false,
        tags: { app_id: 'com.example.events', test: true },
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(storage.events).toHaveLength(1)
    expect(storage.events[0]).toMatchObject({ channel: 'test', event: 'test_event' })
  })

  it('rejects missing, invalid, and malformed event requests', async () => {
    const { app, env } = testApp()

    const noAuth = await app.request('https://api.test/private/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'test', event: 'test_event' }),
    }, env)
    expect(noAuth.status).toBe(401)

    const invalid = await app.request('https://api.test/private/events', {
      method: 'POST',
      headers: { capgkey: 'invalid-key', 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'test', event: 'test_event' }),
    }, env)
    expect(invalid.status).toBe(401)

    const malformed = await app.request('https://api.test/private/events', {
      method: 'POST',
      headers: authHeaders,
      body: 'not json',
    }, env)
    expect(malformed.status).toBe(400)
  })

  it('rejects console broadcasts without an organization id', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/private/events', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ channel: 'test', event: 'test_event', notifyConsole: true }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'missing_org_id' })
  })
})
