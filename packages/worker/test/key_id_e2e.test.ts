import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

async function createApp(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string) {
  const response = await app.request('/app', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, env)
  expect(response.status).toBe(200)
}

function baseData(appId: string, deviceId: string) {
  return {
    app_id: appId,
    device_id: deviceId,
    platform: 'ios',
    version_name: '1.0.0',
    version_build: '1',
    plugin_version: '1.0.0',
    is_emulator: false,
    is_prod: true,
  }
}

describe('[Capgo parity] key_id on public device endpoints', () => {
  it('accepts update requests without key_id for old clients', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.keyid.old'
    const deviceId = 'device-old'
    await createApp(app, env, appId)

    const response = await app.request('/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(baseData(appId, deviceId)),
    }, env)

    expect(response.status).toBe(200)
    await expect(storage.getDevice(appId, deviceId)).resolves.toMatchObject({ keyId: undefined })
  })

  it('stores key_id from updates and rotates it on later requests', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.keyid.update'
    const deviceId = 'device-update'
    await createApp(app, env, appId)

    await app.request('/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseData(appId, deviceId), key_id: 'KEY1' }),
    }, env)
    await app.request('/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseData(appId, deviceId), key_id: 'KEY2' }),
    }, env)

    await expect(storage.getDevice(appId, deviceId)).resolves.toMatchObject({ keyId: 'KEY2' })
  })

  it('stores key_id from stats requests', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.keyid.stats'
    const deviceId = 'device-stats'
    await createApp(app, env, appId)

    const response = await app.request('/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseData(appId, deviceId), action: 'app_ready', key_id: 'STAT' }),
    }, env)

    expect(response.status).toBe(200)
    await expect(storage.getDevice(appId, deviceId)).resolves.toMatchObject({ keyId: 'STAT' })
  })

  it('stores key_id from channel_self POST requests', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.keyid.channel'
    const deviceId = 'device-channel'
    await createApp(app, env, appId)

    const response = await app.request('/channel_self', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseData(appId, deviceId), channel: 'production', key_id: 'CHAN' }),
    }, env)

    expect(response.status).toBe(200)
    await expect(storage.getDevice(appId, deviceId)).resolves.toMatchObject({ keyId: 'CHAN' })
  })

  it.each(['/updates', '/stats', '/channel_self'])('rejects key_id longer than 20 characters on %s', async (path) => {
    const { app, env } = testApp()
    const appId = `com.keyid.reject.${path.replace(/[^a-z]/g, '')}`
    await createApp(app, env, appId)
    const body = path === '/stats'
      ? { ...baseData(appId, 'device-long'), action: 'app_ready', key_id: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }
      : path === '/channel_self'
        ? { ...baseData(appId, 'device-long'), channel: 'production', key_id: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }
        : { ...baseData(appId, 'device-long'), key_id: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }

    const response = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env)

    expect(response.status).toBe(400)
  })
})
