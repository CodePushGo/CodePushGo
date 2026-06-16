import { describe, expect, it } from 'vitest'
import { ALLOWED_STATS_ACTIONS } from '../src/stats-actions'
import { testApp } from './helpers'

const appId = 'com.stats.parity'

function baseStats(deviceId = crypto.randomUUID()) {
  return {
    app_id: appId,
    device_id: deviceId,
    platform: 'ios',
    version_name: '1.0.0',
    version_build: '100',
    version_os: '17.2',
    plugin_version: '1.0.0',
    action: 'app_ready',
  }
}

async function seededApp() {
  const ctx = testApp()
  await ctx.storage.createApp(appId, 'Stats Parity')
  return ctx
}

async function postStats(ctx: ReturnType<typeof testApp>, body: unknown) {
  return ctx.app.request('https://api.test/stats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, ctx.env)
}

describe('[Capgo parity] /stats', () => {
  it('contains unique allowed stats actions', () => {
    expect(new Set(ALLOWED_STATS_ACTIONS).size).toBe(ALLOWED_STATS_ACTIONS.length)
    expect(ALLOWED_STATS_ACTIONS).toEqual(expect.arrayContaining([
      'app_ready',
      'download_fail',
      'webview_javascript_error',
      'native_app_version_changed',
    ]))
  })

  it('creates a device and logs metadata for valid stats', async () => {
    const ctx = await seededApp()
    const response = await postStats(ctx, {
      ...baseStats('device-create'),
      action: 'webview_javascript_error',
      custom_id: 'customer-1',
      is_prod: true,
      is_emulator: false,
      defaultChannel: 'beta',
      metadata: { error_type: 'javascript_error', message: 'boom' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(await ctx.storage.getDevice(appId, 'device-create')).toMatchObject({
      appId,
      deviceId: 'device-create',
      platform: 'ios',
      versionBuild: '100',
      versionName: '1.0.0',
      osVersion: '17.2',
      pluginVersion: '1.0.0',
      customId: 'customer-1',
      isProd: true,
      isEmulator: false,
      defaultChannel: 'beta',
    })
    expect(ctx.storage.stats[0]).toMatchObject({
      app_id: appId,
      device_id: 'device-create',
      action: 'webview_javascript_error',
      metadata: { error_type: 'javascript_error', message: 'boom' },
    })
  })

  it('updates and clears default_channel from stats requests', async () => {
    const ctx = await seededApp()
    const first = await postStats(ctx, { ...baseStats('device-channel'), defaultChannel: 'staging' })
    expect(first.status).toBe(200)
    expect(await ctx.storage.getDevice(appId, 'device-channel')).toMatchObject({ defaultChannel: 'staging' })

    const second = await postStats(ctx, { ...baseStats('device-channel'), defaultChannel: 'production' })
    expect(second.status).toBe(200)
    expect(await ctx.storage.getDevice(appId, 'device-channel')).toMatchObject({ defaultChannel: 'production' })

    const third = await postStats(ctx, baseStats('device-channel'))
    expect(third.status).toBe(200)
    expect((await ctx.storage.getDevice(appId, 'device-channel'))?.defaultChannel).toBeUndefined()
  })

  it('logs fail actions without creating or updating device state', async () => {
    const ctx = await seededApp()
    const response = await postStats(ctx, { ...baseStats('device-fail'), action: 'download_fail' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(await ctx.storage.getDevice(appId, 'device-fail')).toBeUndefined()
    expect(ctx.storage.stats[0]).toMatchObject({ app_id: appId, device_id: 'device-fail', action: 'download_fail' })
  })

  it('returns on_premise_app for unknown apps', async () => {
    const ctx = testApp()
    const response = await postStats(ctx, { ...baseStats('device-missing'), app_id: 'does.not.exist' })

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ error: 'on_premise_app' })
    expect(ctx.storage.stats).toHaveLength(0)
  })

  it('rejects invalid actions without writing stats', async () => {
    const ctx = await seededApp()
    const response = await postStats(ctx, { ...baseStats('device-invalid'), action: 'invalid_action' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_request' })
    expect(ctx.storage.stats).toHaveLength(0)
  })

  it('handles batches with partial failures and same-device actions', async () => {
    const ctx = await seededApp()
    const response = await postStats(ctx, [
      { ...baseStats('device-batch'), action: 'app_ready' },
      { ...baseStats('device-batch'), action: 'install_complete', version_name: '1.0.1' },
      { ...baseStats('device-batch-bad'), action: 'invalid_action' },
    ])

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      results: [
        { status: 'ok' },
        { status: 'ok' },
        expect.objectContaining({ status: 'error', error: 'invalid_request' }),
      ],
    })
    expect(ctx.storage.stats.map(event => event.action)).toEqual(['app_ready', 'install_complete'])
    expect(await ctx.storage.getDevice(appId, 'device-batch')).toMatchObject({ versionName: '1.0.1' })
  })

  it('rejects batches with mixed app ids before writing stats', async () => {
    const ctx = await seededApp()
    await ctx.storage.createApp('com.stats.other', 'Stats Other')

    const response = await postStats(ctx, [
      baseStats('device-mixed-1'),
      { ...baseStats('device-mixed-2'), app_id: 'com.stats.other' },
    ])

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      error: 'mixed_app_ids',
      message: 'All events in a batch must have the same app_id',
    })
    expect(ctx.storage.stats).toHaveLength(0)
  })
})