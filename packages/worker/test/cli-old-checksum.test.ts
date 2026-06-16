import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('tests CLI old checksum (SDK)', () => {
  it('generates a checksum when old CLI uploads do not provide one', async () => {
    const { app, env } = testApp()
    const appId = 'com.cli.old.checksum'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)

    const upload = await app.request(`https://api.test/v1/apps/${appId}/bundles`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/zip',
        'x-codepushgo-version': '1.0.0',
        'x-codepushgo-platform': 'ios',
        'x-codepushgo-channel': 'production',
      },
      body: new Uint8Array([1, 2, 3, 4]),
    }, env)

    expect(upload.status).toBe(201)
    const body = await upload.json() as { release: { checksum: string } }
    expect(body.release.checksum).toMatch(/^[a-f0-9]{64}$/)
  })
})
