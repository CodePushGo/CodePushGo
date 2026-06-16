import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

type TestContext = ReturnType<typeof testApp>

const bundleBytes = new TextEncoder().encode('bundle-data')

function updatePayload(appId: string, overrides: Record<string, unknown> = {}) {
  return {
    app_id: appId,
    device_id: 'device-1',
    platform: 'android',
    version_name: '1.0.0',
    version_build: '1.0.0',
    plugin_version: '7.1.0',
    ...overrides,
  }
}

async function postUpdate(ctx: TestContext, body: Record<string, unknown>) {
  return await ctx.app.request('https://api.test/updates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, ctx.env)
}

async function createRelease(ctx: TestContext, input: {
  appId: string
  version: string
  channel?: string
  sessionKey?: string
  keyId?: string
  platform?: 'ios' | 'android'
  checksum?: string
}) {
  return await ctx.storage.createRelease({
    appId: input.appId,
    version: input.version,
    platform: input.platform ?? 'android',
    sessionKey: input.sessionKey,
    keyId: input.keyId,
    channel: input.channel ?? 'production',
    bytes: bundleBytes.buffer,
    checksum: input.checksum ?? `${input.version}-checksum`,
    size: bundleBytes.byteLength,
    mandatory: false,
    rollout: 100,
  })
}

describe('[Capgo parity] [POST] /updates', () => {
  it('returns no new version when the device already has the latest release', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.none', version: '1.0.0' })

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.none'))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'ok',
      available: false,
      error: 'no_new_version_available',
      kind: 'up_to_date',
    })
  })

  it('returns update metadata for an older device version', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.available', version: '1.2.0', checksum: 'checksum-120' })

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.available', { version_name: '1.1.0' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'ok',
      available: true,
      version: '1.2.0',
      checksum: 'checksum-120',
      channel: 'production',
    })
    expect(json.url).toBe('https://api.test/v1/apps/com.demo.updates.available/bundles/1.2.0/download?platform=android&channel=production')
  })

  it('returns encrypted release metadata for React Native updater clients', async () => {
    const ctx = testApp()
    await createRelease(ctx, {
      appId: 'com.demo.updates.encrypted',
      version: '1.3.0',
      checksum: 'encrypted-checksum',
      sessionKey: 'iv-base64:encrypted-session-key',
      keyId: 'MIIBCgKCAQEAtest12',
    })

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.encrypted', { version_name: '1.2.0', key_id: 'old-key' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'ok',
      available: true,
      version: '1.3.0',
      checksum: 'encrypted-checksum',
      session_key: 'iv-base64:encrypted-session-key',
      sessionKey: 'iv-base64:encrypted-session-key',
      key_id: 'MIIBCgKCAQEAtest12',
      keyId: 'MIIBCgKCAQEAtest12',
    })
  })

  it('accepts bundle_id as the React Native app identity', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.bundleid', version: '2.0.0' })

    const response = await postUpdate(ctx, {
      bundle_id: 'com.demo.updates.bundleid',
      device_id: 'device-1',
      platform: 'android',
      version_name: '1.0.0',
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: true, version: '2.0.0' })
  })

  it('returns the Capgo on-premise error for missing apps', async () => {
    const ctx = testApp()

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.missing'))

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ error: 'on_premise_app' })
  })

  it('uses caller defaultChannel when it is addressable', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.default', version: '1.1.0', channel: 'production' })
    await createRelease(ctx, { appId: 'com.demo.updates.default', version: '3.0.0', channel: 'beta' })

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.default', {
      version_name: '1.0.0',
      defaultChannel: 'beta',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: true, channel: 'beta', version: '3.0.0' })
  })

  it('hides private defaultChannel values that do not allow device self-set', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.private', version: '9.0.0', channel: 'private' })
    await ctx.storage.upsertChannel({ appId: 'com.demo.updates.private', name: 'private', public: false, allowSelfSet: false, android: true })

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.private', {
      version_name: '1.0.0',
      defaultChannel: 'private',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: false, error: 'no_channel' })
  })

  it('allows private self-settable platform-compatible defaultChannel values', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.selfset', version: '9.1.0', channel: 'private' })
    await ctx.storage.upsertChannel({ appId: 'com.demo.updates.selfset', name: 'private', public: false, allowSelfSet: true, android: true })

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.selfset', {
      version_name: '1.0.0',
      defaultChannel: 'private',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: true, channel: 'private', version: '9.1.0' })
  })

  it('hides platform-incompatible defaultChannel values before update checks', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.platform', version: '9.2.0', channel: 'ios-only' })
    await ctx.storage.upsertChannel({ appId: 'com.demo.updates.platform', name: 'ios-only', public: false, allowSelfSet: true, ios: true, android: false })

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.platform', {
      version_name: '1.0.0',
      defaultChannel: 'ios-only',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: false, error: 'no_channel' })
  })

  it('lets persisted device overrides target private channels', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.override', version: '1.1.0', channel: 'production' })
    await createRelease(ctx, { appId: 'com.demo.updates.override', version: '5.0.0', channel: 'private' })
    await ctx.storage.upsertChannel({ appId: 'com.demo.updates.override', name: 'private', public: false, allowSelfSet: false, android: true })
    await ctx.storage.setDeviceChannel('com.demo.updates.override', 'device-override', 'private')

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.override', {
      device_id: 'device-override',
      version_name: '1.0.0',
      defaultChannel: 'production',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: true, channel: 'private', version: '5.0.0' })
  })

  it('does not resolve deleted bundles that are still requested by channel name', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.deleted', version: '4.0.0', channel: 'deleted-channel' })
    await ctx.storage.deleteChannel('com.demo.updates.deleted', 'deleted-channel')

    const response = await postUpdate(ctx, updatePayload('com.demo.updates.deleted', {
      version_name: '1.0.0',
      defaultChannel: 'deleted-channel',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: false, error: 'no_channel' })
  })

  it('saves and clears default_channel like Capgo update requests', async () => {
    const ctx = testApp()
    await createRelease(ctx, { appId: 'com.demo.updates.default-save', version: '1.1.0' })

    const first = await postUpdate(ctx, updatePayload('com.demo.updates.default-save', {
      device_id: 'device-default',
      version_name: '1.0.0',
      defaultChannel: 'staging',
    }))
    expect(first.status).toBe(200)
    expect((await ctx.storage.getDevice('com.demo.updates.default-save', 'device-default'))?.defaultChannel).toBe('staging')

    const second = await postUpdate(ctx, updatePayload('com.demo.updates.default-save', {
      device_id: 'device-default',
      version_name: '1.0.0',
    }))
    expect(second.status).toBe(200)
    expect((await ctx.storage.getDevice('com.demo.updates.default-save', 'device-default'))?.defaultChannel).toBeUndefined()
  })
})
