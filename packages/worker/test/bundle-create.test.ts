import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] [POST] /bundle create with external URL', () => {
  it('creates an external bundle and returns Capgo fields', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundlecreate', name: 'com.example.bundlecreate', owner_org: 'default-org' }),
    }, env)

    const response = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: 'com.example.bundlecreate',
        checksum: 'abc123',
        version: '1.0.0-github-zip',
        external_url: 'https://github.com/CodePushGo/CodePushGo/archive/refs/heads/main.zip',
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'success',
      bundle: {
        app_id: 'com.example.bundlecreate',
        name: '1.0.0-github-zip',
        external_url: 'https://github.com/CodePushGo/CodePushGo/archive/refs/heads/main.zip',
        storage_provider: 'external',
      },
    })
  })

  it('returns Capgo-compatible create errors', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundlecreate', name: 'com.example.bundlecreate', owner_org: 'default-org' }),
    }, env)

    const cases = [
      [{ version: '1.0.0', external_url: 'https://example.com/test.zip' }, 'missing_app_id'],
      [{ app_id: 'com.example.bundlecreate', external_url: 'https://example.com/test.zip' }, 'missing_version'],
      [{ app_id: 'com.example.bundlecreate', version: '1.0.0' }, 'missing_external_url'],
      [{ app_id: 'com.example.bundlecreate', version: '1.0.0-http', external_url: 'http://example.com/test.zip' }, 'invalid_protocol'],
      [{ app_id: 'com.example.missing', version: '1.0.0', external_url: 'https://example.com/test.zip' }, 'cannot_create_bundle'],
    ] as const

    for (const [body, error] of cases) {
      const response = await app.request('https://api.test/bundle', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      }, env)
      expect(response.status, error).toBe(400)
      expect(await response.json()).toMatchObject({ error })
    }
  })
})
