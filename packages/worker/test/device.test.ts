import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] /device operations', () => {
  it('lists, links, reads, and unlinks devices', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.devices', name: 'com.example.devices', owner_org: 'default-org' }),
    }, env)
    await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.devices', channel: 'beta' }),
    }, env)

    const empty = await app.request('https://api.test/device?app_id=com.example.devices', { headers: authHeaders }, env)
    expect(empty.status).toBe(200)
    expect(await empty.json()).toEqual({ data: [], hasMore: false })

    const link = await app.request('https://api.test/device', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: 'com.example.devices',
        device_id: '00000000-0000-0000-0000-000000000000',
        channel: 'beta',
        platform: 'ios',
        plugin_version: '0.1.0',
        version_os: '17.0',
        version_build: '100',
        version_name: '1.0.0',
      }),
    }, env)
    expect(link.status).toBe(200)
    expect(await link.json()).toMatchObject({ status: 'ok', device: { device_id: '00000000-0000-0000-0000-000000000000', channel: 'beta' } })

    const read = await app.request('https://api.test/device?app_id=com.example.devices&device_id=00000000-0000-0000-0000-000000000000', { headers: authHeaders }, env)
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ device_id: '00000000-0000-0000-0000-000000000000', channel: 'beta' })

    const remove = await app.request('https://api.test/device', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.devices', device_id: '00000000-0000-0000-0000-000000000000' }),
    }, env)
    expect(remove.status).toBe(200)
    expect(await remove.json()).toEqual({ status: 'ok' })

    const missing = await app.request('https://api.test/device?app_id=com.example.devices&device_id=00000000-0000-0000-0000-000000000000', { headers: authHeaders }, env)
    expect(missing.status).toBe(404)
  })

  it('rejects invalid ids and invalid version_id shape', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.devices', name: 'com.example.devices', owner_org: 'default-org' }),
    }, env)

    const invalidApp = await app.request('https://api.test/device?app_id=invalid_app', { headers: authHeaders }, env)
    expect(invalidApp.status).toBe(400)

    const invalidVersion = await app.request('https://api.test/device', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.devices', device_id: 'test-device', version_id: '1.0.0' }),
    }, env)
    expect(invalidVersion.status).toBe(400)
  })
})
