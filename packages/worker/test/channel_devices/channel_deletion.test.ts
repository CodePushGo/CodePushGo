import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from '../helpers'

describe('[Capgo parity] channel device deletion constraints', () => {
  it('does not delete channel when a channel-device override is deleted', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.test.channel.deletion'

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
    await storage.clearDeviceChannel(appId, 'device-1')

    expect(await storage.getDeviceChannel(appId, 'device-1')).toBeUndefined()
    expect(await storage.listChannels(appId)).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'beta' })]))
  })
})
