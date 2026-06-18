import { describe, expect, it, vi } from 'vitest'
import { apiKeyBindingsSummary, apiKeyGlobalPermissions, buildApiKeyBinding, buildApiKeyPath, createApiKey, deleteApiKey, isApiKeyExpired, listApiKeys, regenerateApiKey, updateApiKey } from './apikeys'
import { webhookHeaders } from './webhooks'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

const options = {
  apiUrl: 'https://api.example.com/',
  apiKey: 'cpg_admin',
}

describe('[Capgo parity] Worker-backed API key service', () => {
  it('builds API key Worker paths and binding summaries', () => {
    expect(buildApiKeyPath('/apikey', options.apiUrl)).toBe('https://api.example.com/apikey')
    expect(buildApiKeyPath('/apikey/42', options.apiUrl)).toBe('https://api.example.com/apikey/42')
    const binding = buildApiKeyBinding({ roleName: 'org_admin', scopeType: 'org', orgId: 'org_123' })
    expect(binding).toMatchObject({ role_name: 'org_admin', scope_type: 'org', org_id: 'org_123' })
    expect(apiKeyBindingsSummary([binding])).toBe('org_admin on org_123')
    expect(apiKeyGlobalPermissions({ global_permissions: ['org.create'] })).toEqual(['org.create'])
    expect(isApiKeyExpired('2000-01-01T00:00:00.000Z')).toBe(true)
  })

  it('lists API keys through GET /apikey', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: 1, name: 'CLI', bindings: [] }]))
    await expect(listApiKeys({ ...options, fetcher })).resolves.toHaveLength(1)
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/apikey', {
      method: 'GET',
      headers: webhookHeaders('cpg_admin'),
    })
  })

  it('creates API keys and returns the one-time secret', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ id: 1, name: 'CLI', key: 'cpg_secret', bindings: [] }))
    await expect(createApiKey({ ...options, fetcher }, {
      name: 'CLI',
      bindings: [buildApiKeyBinding({ roleName: 'org_admin', scopeType: 'org', orgId: 'org_123' })],
      expiresAt: null,
      globalPermissions: ['org.create'],
    })).resolves.toMatchObject({ success: true, key: 'cpg_secret' })
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][]
    expect(calls[0][0]).toBe('https://api.example.com/apikey')
    expect(calls[0][1].method).toBe('POST')
    expect(JSON.parse(String(calls[0][1].body))).toEqual({
      name: 'CLI',
      bindings: [expect.objectContaining({ role_name: 'org_admin', scope_type: 'org', org_id: 'org_123' })],
      expiresAt: null,
      globalPermissions: ['org.create'],
    })
  })

  it('updates, regenerates, and deletes API keys through Worker endpoints', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE')
        return jsonResponse({ status: 'ok' })
      return jsonResponse({ id: 1, name: 'CLI updated', key: init?.body && String(init.body).includes('regenerate') ? 'cpg_next' : null, bindings: [] })
    })

    await expect(updateApiKey({ ...options, fetcher }, 1, { name: 'CLI updated' })).resolves.toMatchObject({ success: true })
    await expect(regenerateApiKey({ ...options, fetcher }, 1)).resolves.toMatchObject({ success: true, key: 'cpg_next' })
    await expect(deleteApiKey({ ...options, fetcher }, 1)).resolves.toEqual({ success: true })
    expect(fetcher.mock.calls.map(call => [String(call[0]), call[1]?.method])).toEqual([
      ['https://api.example.com/apikey/1', 'PUT'],
      ['https://api.example.com/apikey/1', 'PUT'],
      ['https://api.example.com/apikey/1', 'DELETE'],
    ])
  })
})
