import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { parseServiceAccountKey, validateServiceAccountJson } from '../src/build/onboarding/android/service-account-validation'

const TEST_PACKAGE = 'com.example.app'

function serviceAccountJson(overrides: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify({
    type: 'service_account',
    client_email: 'capgo-build@example-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nnot-used-by-these-tests\n-----END PRIVATE KEY-----\n',
    project_id: 'example-project',
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
      return handlers.token?.() ?? new Response(JSON.stringify({ access_token: 'fake-token' }), { status: 200 })
    }
    if (init?.method === 'DELETE') {
      calls.delete++
      return handlers.delete?.() ?? new Response(null, { status: 204 })
    }
    if (urlString.includes('/edits')) {
      calls.insert++
      return handlers.insert?.() ?? new Response(JSON.stringify({ id: 'edit-123' }), { status: 200 })
    }
    throw new Error(`Unexpected URL: ${urlString}`)
  }
  return { calls, fetchImpl }
}

describe('[Capgo parity] Android service-account validation', () => {
  it('parses Google service account JSON and rejects malformed input before network calls', async () => {
    const key = parseServiceAccountKey(serviceAccountJson())
    expect(key.client_email).toBe('capgo-build@example-project.iam.gserviceaccount.com')

    let fetchCalled = false
    await expect(validateServiceAccountJson({
      jsonBytes: serviceAccountJson({ token_uri: 'https://example.test/token' }),
      packageName: TEST_PACKAGE,
      fetchImpl: async () => {
        fetchCalled = true
        throw new Error('fetch should not be called')
      },
    })).resolves.toMatchObject({ ok: false, kind: 'shape-error' })
    expect(fetchCalled).toBe(false)
  })

  it('classifies token, network, and permission failures', async () => {
    await expect(validateServiceAccountJson({
      jsonBytes: serviceAccountJson(),
      packageName: TEST_PACKAGE,
      fetchImpl: mockFetch({ token: () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 401 }) }).fetchImpl,
    })).resolves.toMatchObject({ ok: false, kind: 'token-error' })

    await expect(validateServiceAccountJson({
      jsonBytes: serviceAccountJson(),
      packageName: TEST_PACKAGE,
      fetchImpl: mockFetch({ token: () => new Response('<html>bad gateway</html>', { status: 200 }) }).fetchImpl,
    })).resolves.toMatchObject({ ok: false, kind: 'network-error' })

    await expect(validateServiceAccountJson({
      jsonBytes: serviceAccountJson(),
      packageName: TEST_PACKAGE,
      fetchImpl: mockFetch({ insert: () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }) }).fetchImpl,
    })).resolves.toMatchObject({ ok: false, kind: 'permission-error' })
  })

  it('validates Google Play edit access and deletes the probe edit', async () => {
    const { calls, fetchImpl } = mockFetch({})

    await expect(validateServiceAccountJson({ jsonBytes: serviceAccountJson(), packageName: TEST_PACKAGE, fetchImpl })).resolves.toEqual({
      ok: true,
      clientEmail: 'capgo-build@example-project.iam.gserviceaccount.com',
      projectId: 'example-project',
    })
    expect(calls).toEqual({ token: 1, insert: 1, delete: 1 })
  })
})
