import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function keyHeaders(key: string) {
  return { capgkey: key, 'content-type': 'application/json' }
}

async function createHashedKeyContext() {
  const ctx = testApp()
  const appId = 'com.cli.hashed.apikey'
  await ctx.app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  await ctx.app.request('https://api.test/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, version: '1.0.0', platform: 'ios', channel: 'production', external_url: 'https://cdn.example.com/one.zip' }),
  }, ctx.env)
  const response = await ctx.app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'cli-hashed-key', bindings: [{ role_name: 'org_admin', scope_type: 'org', org_id: 'default-org' }] }),
  }, ctx.env)
  expect(response.status).toBe(200)
  const key = await response.json() as { id: number, key: string, key_hash: string }
  expect(key.key_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(key.key_hash).not.toBe(key.key)
  return { ...ctx, appId, key }
}

describe('cli operations with hashed API key', () => {
  it('lists apps, bundles, and channels with a hashed API key', async () => {
    const { app, env, appId, key } = await createHashedKeyContext()

    const apps = await app.request('https://api.test/app', { headers: keyHeaders(key.key) }, env)
    expect(apps.status).toBe(200)
    await expect(apps.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ app_id: appId })]))

    const bundles = await app.request(`https://api.test/bundle?app_id=${appId}`, { headers: keyHeaders(key.key) }, env)
    expect(bundles.status).toBe(200)
    await expect(bundles.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ app_id: appId, version: '1.0.0' })]))

    const channels = await app.request(`https://api.test/channel/${appId}`, { headers: keyHeaders(key.key) }, env)
    expect(channels.status).toBe(200)
    await expect(channels.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'production' })]))
  })

  it('creates, updates, and deletes channels with a hashed API key', async () => {
    const { app, env, appId, key } = await createHashedKeyContext()
    const channel = 'hashed-key-channel'

    const create = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: keyHeaders(key.key),
      body: JSON.stringify({ app_id: appId, channel }),
    }, env)
    expect(create.status).toBe(200)

    const update = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: keyHeaders(key.key),
      body: JSON.stringify({ app_id: appId, channel, ios: true, android: true }),
    }, env)
    expect(update.status).toBe(200)

    const remove = await app.request('https://api.test/channel', {
      method: 'DELETE',
      headers: keyHeaders(key.key),
      body: JSON.stringify({ app_id: appId, channel }),
    }, env)
    expect(remove.status).toBe(200)
  })
})
