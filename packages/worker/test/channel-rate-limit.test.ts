import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const OP_LIMIT_PER_SECOND = 5

type CacheStore = Map<string, Response>

let previousCaches: typeof globalThis.caches | undefined

function installMemoryCache() {
  const store: CacheStore = new Map()
  const cache = {
    match: async (request: Request) => store.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => {
      store.set(request.url, response.clone())
    },
  }

  previousCaches = globalThis.caches
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open: async () => cache },
  })

  return store
}

function restoreCaches() {
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: previousCaches,
  })
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function seedPublicApp() {
  const ctx = testApp()
  const appId = `com.rate.limit.${crypto.randomUUID()}`
  await ctx.app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  await ctx.storage.upsertChannel({ appId, name: 'production', public: true, allowSelfSet: true })
  await ctx.storage.upsertChannel({ appId, name: 'beta', public: true, allowSelfSet: true })
  return { ...ctx, appId }
}

describe('[Capgo parity] channel and update public device rate limiting', () => {
  beforeEach(() => {
    installMemoryCache()
  })

  afterEach(() => {
    restoreCaches()
  })

  it('rate limits repeated update checks per app, device, and operation bucket', async () => {
    const { app, env, appId } = await seedPublicApp()
    const body = {
      app_id: appId,
      device_id: 'device-updates',
      platform: 'ios',
      version_name: '1.0.0',
    }

    for (let i = 0; i < OP_LIMIT_PER_SECOND; i++) {
      const response = await app.request('https://api.test/updates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }, env)
      expect(response.status).not.toBe(429)
    }

    const limited = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env)
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ error: 'too_many_requests' })

    await sleep(1100)

    const allowed = await app.request('https://api.test/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env)
    expect(allowed.status).not.toBe(429)
  })

  it('rate limits one channel_self operation without affecting another', async () => {
    const { app, env, appId, storage } = await seedPublicApp()
    const deviceId = 'device-channel-independent'

    for (let i = 0; i <= OP_LIMIT_PER_SECOND; i++)
      await storage.upsertChannel({ appId, name: `rl-${i}`, public: true, allowSelfSet: true })

    for (let i = 0; i < OP_LIMIT_PER_SECOND; i++) {
      const response = await app.request('https://api.test/channel_self', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: appId, device_id: deviceId, platform: 'ios', channel: `rl-${i}` }),
      }, env)
      expect(response.status).not.toBe(429)
    }

    const postLimited = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: deviceId, platform: 'ios', channel: `rl-${OP_LIMIT_PER_SECOND}` }),
    }, env)
    expect(postLimited.status).toBe(429)

    const put = await app.request('https://api.test/channel_self', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: deviceId, platform: 'ios', defaultChannel: 'production' }),
    }, env)
    expect(put.status).not.toBe(429)
  })

  it('rate limits setting the same channel within 60 seconds but allows a different channel after the op bucket resets', async () => {
    const { app, env, appId } = await seedPublicApp()
    const deviceId = 'device-same-channel'

    const first = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: deviceId, platform: 'ios', channel: 'production' }),
    }, env)
    expect(first.status).not.toBe(429)

    await sleep(1100)

    const sameChannel = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: deviceId, platform: 'ios', channel: 'production' }),
    }, env)
    expect(sameChannel.status).toBe(429)

    const differentChannel = await app.request('https://api.test/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, device_id: deviceId, platform: 'ios', channel: 'beta' }),
    }, env)
    expect(differentChannel.status).not.toBe(429)
  })
})
