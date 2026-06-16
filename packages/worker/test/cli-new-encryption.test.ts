import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] cli-new-encryption.test.ts', () => {
  it('stores encrypted CLI upload metadata and returns it to updater clients', async () => {
    const { app, env } = testApp()
    const appId = 'com.demo.cli.encryption'

    await app.request('/v1/apps', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId }),
    }, env)

    const upload = await app.request(`/v1/apps/${appId}/bundles`, {
      method: 'POST',
      headers: {
        authorization: authHeaders.authorization,
        'content-type': 'application/zip',
        'x-codepushgo-version': '2.0.0',
        'x-codepushgo-platform': 'android',
        'x-codepushgo-channel': 'production',
        'x-codepushgo-checksum': 'encrypted-checksum',
        'x-codepushgo-session-key': 'iv-base64:encrypted-session-key',
        'x-codepushgo-key-id': 'MIIBCgKCAQEAtest12',
      },
      body: new Uint8Array([1, 2, 3]),
    }, env)

    expect(upload.status).toBe(201)
    await expect(upload.json()).resolves.toMatchObject({
      status: 'ok',
      release: {
        checksum: 'encrypted-checksum',
        sessionKey: 'iv-base64:encrypted-session-key',
        keyId: 'MIIBCgKCAQEAtest12',
      },
    })

    const update = await app.request('/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        device_id: 'device-1',
        platform: 'android',
        version_name: '1.0.0',
        version_build: '1',
        plugin_version: '7.1.0',
        key_id: 'old-key',
      }),
    }, env)

    expect(update.status).toBe(200)
    await expect(update.json()).resolves.toMatchObject({
      status: 'ok',
      available: true,
      checksum: 'encrypted-checksum',
      session_key: 'iv-base64:encrypted-session-key',
      sessionKey: 'iv-base64:encrypted-session-key',
      key_id: 'MIIBCgKCAQEAtest12',
      keyId: 'MIIBCgKCAQEAtest12',
    })
  })
})
