import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const baselinePackages = [
  { name: 'react-native', version: '0.80.0' },
  { name: '@codepushgo/react-native-updater', version: '^1.2.0' },
]

describe('tests CLI metadata', () => {
  it('uploads bundle metadata and checks matching native packages as compatible', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.cli.meta.compatible'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)

    const upload = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: appId,
        version: '1.0.0',
        platform: 'ios',
        channel: 'production',
        external_url: 'https://cdn.example.com/meta.zip',
        native_packages: baselinePackages,
      }),
    }, env)
    expect(upload.status).toBe(200)
    await expect(upload.json()).resolves.toMatchObject({ bundle: { native_packages: baselinePackages } })
    expect((await storage.listReleases(appId))[0]?.nativePackages).toEqual(baselinePackages)

    const compatibility = await app.request('https://api.test/bundle/compatibility', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel: 'production', platform: 'ios', native_packages: baselinePackages }),
    }, env)
    expect(compatibility.status).toBe(200)
    await expect(compatibility.json()).resolves.toMatchObject({
      status: 'ok',
      compatible: true,
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'react-native', compatible: true, status: 'unchanged' }),
      ]),
    })
  })

  it('reports native package version mismatches from uploaded metadata', async () => {
    const { app, env } = testApp()
    const appId = 'com.cli.meta.mismatch'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)
    await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, version: '1.0.0', platform: 'ios', channel: 'production', external_url: 'https://cdn.example.com/meta.zip', nativePackages: baselinePackages }),
    }, env)

    const compatibility = await app.request('https://api.test/bundle/compatibility', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, channel: 'production', platform: 'ios', native_packages: [{ name: 'react-native', version: '0.79.0' }] }),
    }, env)

    expect(compatibility.status).toBe(200)
    await expect(compatibility.json()).resolves.toMatchObject({
      compatible: false,
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'react-native', compatible: false, reasons: expect.arrayContaining(['version_mismatch']) }),
      ]),
    })
  })
})
