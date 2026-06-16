import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] /bundle operations', () => {
  it('lists, creates from external URL, reads, and deletes bundles', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundles', name: 'com.example.bundles', owner_org: 'default-org' }),
    }, env)

    const empty = await app.request('https://api.test/bundle?app_id=com.example.bundles', { headers: authHeaders }, env)
    expect(empty.status).toBe(200)
    expect(await empty.json()).toEqual([])

    const create = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: 'com.example.bundles',
        version: '1.0.0-github-zip',
        checksum: 'abc123',
        external_url: 'https://example.com/bundle.zip',
      }),
    }, env)
    expect(create.status).toBe(200)
    expect(await create.json()).toMatchObject({
      status: 'success',
      bundle: {
        app_id: 'com.example.bundles',
        name: '1.0.0-github-zip',
        external_url: 'https://example.com/bundle.zip',
        storage_provider: 'external',
      },
    })

    const duplicate = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: 'com.example.bundles',
        version: '1.0.0-github-zip',
        checksum: 'abc123',
        external_url: 'https://example.com/bundle.zip',
      }),
    }, env)
    expect(duplicate.status).toBe(400)
    expect(await duplicate.json()).toMatchObject({ error: 'version_already_exists' })

    const read = await app.request('https://api.test/bundle/com.example.bundles/1.0.0-github-zip', { headers: authHeaders }, env)
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ app_id: 'com.example.bundles', name: '1.0.0-github-zip' })

    const removeOne = await app.request('https://api.test/bundle', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundles', version: '1.0.0-github-zip' }),
    }, env)
    expect(removeOne.status).toBe(200)
    expect(await removeOne.json()).toEqual({ status: 'ok' })

    const missing = await app.request('https://api.test/bundle/com.example.bundles/1.0.0-github-zip', { headers: authHeaders }, env)
    expect(missing.status).toBe(404)
  })

  it('returns Capgo-compatible errors for invalid create/delete requests', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundles', name: 'com.example.bundles', owner_org: 'default-org' }),
    }, env)

    const missingApp = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ version: '1.0.0', external_url: 'https://example.com/bundle.zip' }),
    }, env)
    expect(missingApp.status).toBe(400)
    expect(await missingApp.json()).toMatchObject({ error: 'missing_app_id' })

    const missingVersion = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundles', external_url: 'https://example.com/bundle.zip' }),
    }, env)
    expect(missingVersion.status).toBe(400)
    expect(await missingVersion.json()).toMatchObject({ error: 'missing_version' })

    const missingUrl = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundles', version: '1.0.0' }),
    }, env)
    expect(missingUrl.status).toBe(400)
    expect(await missingUrl.json()).toMatchObject({ error: 'missing_external_url' })

    const invalidProtocol = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundles', version: '1.0.0-http', external_url: 'http://example.com/bundle.zip' }),
    }, env)
    expect(invalidProtocol.status).toBe(400)
    expect(await invalidProtocol.json()).toMatchObject({ error: 'invalid_protocol' })

    const noAccess = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.missing', version: '1.0.0', external_url: 'https://example.com/bundle.zip' }),
    }, env)
    expect(noAccess.status).toBe(400)
    expect(await noAccess.json()).toMatchObject({ error: 'cannot_create_bundle' })

    const invalidDelete = await app.request('https://api.test/bundle', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.bundles', version: 'invalid_version' }),
    }, env)
    expect(invalidDelete.status).toBe(400)
  })
})
