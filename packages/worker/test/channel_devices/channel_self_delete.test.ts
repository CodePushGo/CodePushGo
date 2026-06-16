import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from '../helpers'

describe('[Capgo parity] channel_self delete constraints', () => {
  it('does not delete channel when channel_self deleteOverride is called', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.test.channel.self.delete'

    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)

    await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel: 'beta', public: true, allow_self_set: true }),
    }, env)

    await storage.setDeviceChannel(appId, 'device-1', 'beta')

    const url = new URL('https://api.test/channel_self')
    url.searchParams.set('app_id', appId)
    url.searchParams.set('device_id', 'device-1')
    url.searchParams.set('version_build', '1.0.0')
    url.searchParams.set('version_name', '1.0.0')
    url.searchParams.set('is_emulator', 'false')
    url.searchParams.set('is_prod', 'true')
    url.searchParams.set('platform', 'android')

    const response = await app.request(url, { method: 'DELETE' }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(await storage.getDeviceChannel(appId, 'device-1')).toBeUndefined()
    expect(await storage.listChannels(appId)).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'beta' })]))
  })
})
