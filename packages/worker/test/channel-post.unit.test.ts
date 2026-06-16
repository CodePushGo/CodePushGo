import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] public channel post platform metadata', () => {
  async function createApp() {
    const ctx = testApp()
    await ctx.app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.test.channel.post', name: 'com.test.channel.post', owner_org: 'default-org' }),
    }, ctx.env)
    return ctx
  }

  it('defaults legacy public mobile channel writes to electron false', async () => {
    const { app, env } = await createApp()

    const response = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: 'com.test.channel.post',
        channel: 'ios-default',
        public: true,
        ios: true,
        android: false,
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'ok',
      channel: {
        name: 'ios-default',
        public: true,
        ios: true,
        android: false,
        electron: false,
      },
    })
  })

  it('preserves explicit electron platform selection', async () => {
    const { app, env } = await createApp()

    const response = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: 'com.test.channel.post',
        channel: 'all-platforms',
        public: true,
        ios: true,
        android: true,
        electron: true,
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ channel: { electron: true } })
  })

  it('keeps legacy all-platform public writes electron-compatible when both mobile flags are true', async () => {
    const { app, env } = await createApp()

    const response = await app.request('https://api.test/channel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: 'com.test.channel.post',
        channel: 'production',
        public: true,
        ios: true,
        android: true,
      }),
    }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as { channel: { ios?: boolean, android?: boolean, electron?: boolean } }
    expect(body).toMatchObject({
      channel: {
        ios: true,
        android: true,
      },
    })
    expect(body.channel).not.toHaveProperty('electron')
  })
})
