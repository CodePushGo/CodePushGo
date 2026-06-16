import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const appId = 'com.example.channelself'

async function seedChannels() {
  const ctx = testApp()
  await ctx.app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  await ctx.storage.upsertChannel({ appId, name: 'beta', public: true, allowSelfSet: true })
  await ctx.storage.upsertChannel({ appId, name: 'locked', public: true, allowSelfSet: false })
  return ctx
}

describe('[Capgo parity] /channel_self operations', () => {
  it('rejects invalid json bodies', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'invalid json ;-)',
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_json_body' })
  })

  it('returns Capgo-style 200 errors for missing, unknown, and locked channels', async () => {
    const { app, env } = await seedChannels()

    const missing = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: 'device-1', platform: 'ios' }),
    }, env)
    expect(missing.status).toBe(200)
    expect(await missing.json()).toMatchObject({ error: 'missing_channel' })

    const unknown = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: 'device-1', platform: 'ios', channel: 'missing' }),
    }, env)
    expect(unknown.status).toBe(200)
    expect(await unknown.json()).toMatchObject({ error: 'channel_not_found' })

    const locked = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: 'device-1', platform: 'ios', channel: 'locked' }),
    }, env)
    expect(locked.status).toBe(200)
    expect(await locked.json()).toMatchObject({ error: 'public_channel_self_set_not_allowed' })
  })

  it('lists channels and reports non-existent apps like Capgo', async () => {
    const { app, env } = await seedChannels()

    const noQuery = await app.request('https://api.test/channel_self', { method: 'GET' }, env)
    expect(noQuery.status).toBe(400)
    expect(await noQuery.json()).toMatchObject({ error: 'invalid_query_parameters' })

    const missingAppId = await app.request('https://api.test/channel_self?device_id=device-1&platform=ios', { method: 'GET' }, env)
    expect(missingAppId.status).toBe(400)
    expect(await missingAppId.json()).toMatchObject({ error: 'missing_app_id' })

    const notFound = await app.request('https://api.test/channel_self?app_id=com.missing.app&device_id=device-1&platform=ios', { method: 'GET' }, env)
    expect(notFound.status).toBe(429)
    expect(await notFound.json()).toMatchObject({ error: 'on_premise_app' })

    const channels = await app.request(`https://api.test/channel_self?app_id=${appId}&device_id=device-1&platform=ios`, { method: 'GET' }, env)
    expect(channels.status).toBe(200)
    expect(await channels.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'beta', allowSelfSet: true }),
      expect.objectContaining({ name: 'locked', allowSelfSet: false }),
    ]))
  })

  it('sets, reads, and clears device channel overrides', async () => {
    const { app, env } = await seedChannels()

    const set = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: 'device-1', platform: 'ios', channel: 'beta' }),
    }, env)
    expect(await set.json()).toEqual({ status: 'ok', channel: 'beta' })

    const read = await app.request('https://api.test/channel_self', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: 'device-1', defaultChannel: 'production' }),
    }, env)
    expect(await read.json()).toEqual({ status: 'override', channel: 'beta' })

    const remove = await app.request(`https://api.test/channel_self?app_id=${appId}&device_id=device-1`, { method: 'DELETE' }, env)
    expect(await remove.json()).toEqual({ status: 'ok' })
  })
})
