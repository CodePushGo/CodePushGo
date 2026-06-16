import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { parseServiceAccountKey, validateServiceAccountJson } from '../../cli/src/build/onboarding/android/service-account-validation'

const TEST_PACKAGE = 'com.example.app'

function buildSaJson(overrides: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify({
    type: 'service_account',
    client_email: 'sa@my-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
    project_id: 'my-project',
    token_uri: 'https://oauth2.googleapis.com/token',
    private_key_id: 'abc123',
    ...overrides,
  }))
}

function mockFetch(handlers: { token?: () => Response, insert?: () => Response, delete?: () => Response }) {
  const calls = { token: 0, insert: 0, delete: 0 }
  const fetchImpl: typeof fetch = async (url, init) => {
    const urlString = typeof url === 'string' ? url : url.toString()
    if (urlString.includes('/token')) {
      calls.token++
      if (!handlers.token)
        throw new Error(`Unexpected token request: ${urlString}`)
      return handlers.token()
    }
    if (init?.method === 'DELETE') {
      calls.delete++
      return handlers.delete?.() ?? new Response(null, { status: 204 })
    }
    if (urlString.includes('/edits')) {
      calls.insert++
      if (!handlers.insert)
        throw new Error(`Unexpected edit request: ${urlString}`)
      return handlers.insert()
    }
    throw new Error(`Unexpected URL: ${urlString}`)
  }
  return { calls, fetchImpl }
}

describe('[Capgo parity] service account validation', () => {
  it('parses valid service account JSON', () => {
    const key = parseServiceAccountKey(buildSaJson())
    expect(key.client_email).toBe('sa@my-project.iam.gserviceaccount.com')
    expect(key.project_id).toBe('my-project')
  })

  it('returns shape-error for malformed JSON and missing fields', async () => {
    await expect(validateServiceAccountJson({ jsonBytes: Buffer.from('garbage'), packageName: TEST_PACKAGE, fetchImpl: mockFetch({}).fetchImpl })).resolves.toMatchObject({ ok: false, kind: 'shape-error' })
    await expect(validateServiceAccountJson({ jsonBytes: buildSaJson({ private_key: undefined }), packageName: TEST_PACKAGE, fetchImpl: mockFetch({}).fetchImpl })).resolves.toMatchObject({ ok: false, kind: 'shape-error' })
  })

  it('classifies token endpoint rejections and transient failures', async () => {
    await expect(validateServiceAccountJson({
      jsonBytes: buildSaJson(),
      packageName: TEST_PACKAGE,
      fetchImpl: mockFetch({ token: () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 401 }) }).fetchImpl,
    })).resolves.toMatchObject({ ok: false, kind: 'token-error' })

    await expect(validateServiceAccountJson({
      jsonBytes: buildSaJson(),
      packageName: TEST_PACKAGE,
      fetchImpl: mockFetch({ token: () => new Response('<html>bad gateway</html>', { status: 200 }) }).fetchImpl,
    })).resolves.toMatchObject({ ok: false, kind: 'network-error' })
  })

  it('validates Google Play edit access and cleans up the probe edit', async () => {
    const { calls, fetchImpl } = mockFetch({
      token: () => new Response(JSON.stringify({ access_token: 'fake-token' }), { status: 200 }),
      insert: () => new Response(JSON.stringify({ id: 'edit-123' }), { status: 200 }),
      delete: () => new Response(null, { status: 204 }),
    })

    await expect(validateServiceAccountJson({ jsonBytes: buildSaJson(), packageName: TEST_PACKAGE, fetchImpl })).resolves.toEqual({ ok: true, clientEmail: 'sa@my-project.iam.gserviceaccount.com', projectId: 'my-project' })
    expect(calls).toEqual({ token: 1, insert: 1, delete: 1 })
  })

  it('returns permission-error when Google Play edit access is denied', async () => {
    await expect(validateServiceAccountJson({
      jsonBytes: buildSaJson(),
      packageName: TEST_PACKAGE,
      fetchImpl: mockFetch({
        token: () => new Response(JSON.stringify({ access_token: 'fake-token' }), { status: 200 }),
        insert: () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }),
      }).fetchImpl,
    })).resolves.toMatchObject({ ok: false, kind: 'permission-error' })
  })
})
