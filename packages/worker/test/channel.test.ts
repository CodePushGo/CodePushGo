import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] /channel operations', () => {
  it('gets, creates, updates, and deletes channels', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.channels', name: 'com.example.channels', owner_org: 'default-org' }),
    }, env)

    const list = await app.request('https://api.test/channel?app_id=com.example.channels', { headers: authHeaders }, env)
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual([expect.objectContaining({ name: 'production', public: true })])

    const production = await app.request('https://api.test/channel?app_id=com.example.channels&channel=production', { headers: authHeaders }, env)
    expect(production.status).toBe(200)
    expect(await production.json()).toMatchObject({ name: 'production' })

    const create = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.channels', channel: 'beta', public: true }),
    }, env)
    expect(create.status).toBe(200)
    expect(await create.json()).toMatchObject({ status: 'ok', channel: { name: 'beta', public: true } })

    const update = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.channels', channel: 'beta', public: false }),
    }, env)
    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({ status: 'ok', channel: { name: 'beta', public: false } })

    const remove = await app.request('https://api.test/channel', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.channels', channel: 'beta' }),
    }, env)
    expect(remove.status).toBe(200)
    expect(await remove.json()).toEqual({ status: 'ok' })

    const missing = await app.request('https://api.test/channel', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.channels', channel: 'beta' }),
    }, env)
    expect(missing.status).toBe(400)
    expect(await missing.json()).toMatchObject({ error: 'channel_not_found' })
  })

  it('rejects invalid app ids', async () => {
    const { app, env } = testApp()

    const response = await app.request('https://api.test/channel?app_id=invalid_app', { headers: authHeaders }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_app_id' })
  })
})
