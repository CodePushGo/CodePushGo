import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function uniqueChannel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

describe('[Capgo parity] CLI channel backend contract', () => {
  it('creates and lists channels for an existing React Native app id', async () => {
    const { app, env } = testApp()
    const appId = 'com.cli.channel.create'
    const channel = uniqueChannel('test-channel')
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)

    const create = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel }),
    }, env)
    expect(create.status).toBe(200)
    await expect(create.json()).resolves.toMatchObject({ status: 'ok', channel: { name: channel } })

    const list = await app.request(`https://api.test/channel/${appId}`, { headers: authHeaders }, env)
    expect(list.status).toBe(200)
    await expect(list.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: channel })]))
  })

  it('rejects channel creation for an unknown app id', async () => {
    const { app, env } = testApp()

    const create = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.cli.channel.missing', channel: uniqueChannel('missing') }),
    }, env)

    expect(create.status).toBe(404)
    await expect(create.json()).resolves.toMatchObject({ error: 'app_not_found' })
  })

  it('rejects duplicate channel creation instead of silently updating it', async () => {
    const { app, env } = testApp()
    const appId = 'com.cli.channel.duplicate'
    const channel = uniqueChannel('duplicate')
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)
    await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel }),
    }, env)

    const duplicate = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel }),
    }, env)

    expect(duplicate.status).toBe(400)
    await expect(duplicate.json()).resolves.toMatchObject({ error: 'channel_already_exists' })
  })
})
