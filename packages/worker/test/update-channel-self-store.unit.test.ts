import { describe, expect, it, vi } from 'vitest'
import { authHeaders, testApp } from './helpers'

function createStore() {
  const values = new Map<string, string>()
  return {
    values,
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const value = values.get(key)
      if (!value)
        return null
      return options?.type === 'json' ? JSON.parse(value) : value
    }),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key)
    }),
  }
}

async function seedApp() {
  const ctx = testApp()
  const appId = 'com.test.update.channel.self.store'
  await ctx.app.request('/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  await ctx.app.request('/channel', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, channel: 'beta', public: true, allow_self_set: true }),
  }, ctx.env)
  await ctx.app.request('/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, version: '2.0.0', channel: 'beta', platform: 'ios', external_url: 'https://updates.example/beta.zip' }),
  }, ctx.env)
  await ctx.app.request('/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, version: '1.1.0', channel: 'production', platform: 'ios', external_url: 'https://updates.example/prod.zip' }),
  }, ctx.env)
  return { ...ctx, appId }
}

async function requestUpdate(input: { app: ReturnType<typeof testApp>['app'], appId: string, env: ReturnType<typeof testApp>['env'], pluginVersion: string }) {
  return await input.app.request('/updates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: input.appId,
      defaultChannel: 'production',
      device_id: '11111111-1111-4111-8111-111111111111',
      platform: 'ios',
      plugin_version: input.pluginVersion,
      version_build: '1.0.0',
      version_name: '1.0.0',
    }),
  }, input.env)
}

describe('[Capgo parity] updates channel_self store override routing', () => {
  it('queries KV-backed channel_self override only for old plugin versions', async () => {
    const { app, appId, env } = await seedApp()
    const store = createStore()
    store.values.set(`channel_self:v1:${appId}:11111111-1111-4111-8111-111111111111`, JSON.stringify({
      app_id: appId,
      channel_name: 'beta',
      device_id: '11111111-1111-4111-8111-111111111111',
      updated_at: '2026-01-01T00:00:00.000Z',
    }))

    const oldResponse = await requestUpdate({ app, appId, env: { ...env, CHANNEL_SELF_STORE: store }, pluginVersion: '7.33.0' })
    expect(oldResponse.status).toBe(200)
    expect(store.get).toHaveBeenCalledOnce()
    expect(await oldResponse.json()).toMatchObject({ available: true, channel: 'beta', version: '2.0.0' })

    store.get.mockClear()

    const newResponse = await requestUpdate({ app, appId, env: { ...env, CHANNEL_SELF_STORE: store }, pluginVersion: '7.34.0' })
    expect(newResponse.status).toBe(200)
    expect(store.get).not.toHaveBeenCalled()
    expect(await newResponse.json()).toMatchObject({ available: true, channel: 'production', version: '1.1.0' })

    store.values.clear()
    store.get.mockClear()

    const oldMissingKvResponse = await requestUpdate({ app, appId, env: { ...env, CHANNEL_SELF_STORE: store }, pluginVersion: '7.33.0' })
    expect(oldMissingKvResponse.status).toBe(200)
    expect(store.get).toHaveBeenCalledOnce()
    expect(await oldMissingKvResponse.json()).toMatchObject({ available: true, channel: 'production', version: '1.1.0' })
  })
})
