import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

async function uploadBundle(input: ReturnType<typeof testApp>, appId: string, headers: Record<string, string> = {}) {
  return input.app.request(`/v1/apps/${appId}/bundles`, {
    method: 'POST',
    headers: {
      authorization: authHeaders.authorization,
      'content-type': 'application/zip',
      'x-codepushgo-version': '2.0.0',
      'x-codepushgo-platform': 'android',
      'x-codepushgo-channel': 'production',
      'x-codepushgo-checksum': 'checksum',
      ...headers,
    },
    body: new Uint8Array([1, 2, 3]),
  }, input.env)
}

describe('[Capgo parity] encrypted bundle enforcement', () => {
  it('updates organization encryption settings and enforces encrypted uploads', async () => {
    const ctx = testApp()
    const orgId = 'org-encrypted'
    const appId = 'com.demo.encrypted.enforced'

    await ctx.storage.upsertOrganization({ id: orgId, name: 'Encrypted Org' })
    await ctx.storage.createApp(appId, appId, orgId)

    const update = await ctx.app.request('/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ id: orgId, enforce_encrypted_bundles: true, required_encryption_key: 'MIIBCgKCAQEAtest1234' }),
    }, ctx.env)
    expect(update.status).toBe(200)
    await expect(update.json()).resolves.toMatchObject({
      enforce_encrypted_bundles: true,
      required_encryption_key: 'MIIBCgKCAQEAtest1234',
    })

    const unencrypted = await uploadBundle(ctx, appId)
    expect(unencrypted.status).toBe(400)
    await expect(unencrypted.json()).resolves.toMatchObject({ error: 'encryption_required' })

    const wrongKey = await uploadBundle(ctx, appId, {
      'x-codepushgo-session-key': 'iv:session',
      'x-codepushgo-key-id': 'DIFFERENTKEYID12345',
    })
    expect(wrongKey.status).toBe(400)
    await expect(wrongKey.json()).resolves.toMatchObject({ error: 'encryption_key_mismatch' })

    const encrypted = await uploadBundle(ctx, appId, {
      'x-codepushgo-session-key': 'iv:session',
      'x-codepushgo-key-id': 'MIIBCgKCAQEAtest1234',
    })
    expect(encrypted.status).toBe(201)
    await expect(encrypted.json()).resolves.toMatchObject({
      status: 'ok',
      release: { sessionKey: 'iv:session', keyId: 'MIIBCgKCAQEAtest1234' },
    })
  })

  it('rejects invalid required encryption key lengths through the organization endpoint', async () => {
    const ctx = testApp()
    const orgId = 'org-encrypted-invalid'
    await ctx.storage.upsertOrganization({ id: orgId, name: 'Encrypted Invalid Org' })

    const response = await ctx.app.request('/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ id: orgId, enforce_encrypted_bundles: true, required_encryption_key: 'short' }),
    }, ctx.env)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_required_encryption_key' })
  })
})
