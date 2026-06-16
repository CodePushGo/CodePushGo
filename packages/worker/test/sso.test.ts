import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const ssoHeaders = {
  authorization: 'Bearer supabase-session-token',
  'content-type': 'application/json',
}

describe('[Capgo parity] SSO endpoints', () => {
  it('provisions SSO users into the configured organization', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertSsoProvider({ providerId: 'provider-sso-test', orgId: 'org-sso-test', domain: 'managed.test', enforceSso: true })

    const response = await app.request('/private/sso/provision-user', {
      method: 'POST',
      headers: ssoHeaders,
      body: JSON.stringify({
        user_id: 'user-sso-test',
        email: 'user@managed.test',
        provider: 'sso:provider-sso-test',
        providers: ['sso:provider-sso-test'],
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      org_id: 'org-sso-test',
      user_id: 'user-sso-test',
    })
    expect(await storage.getOrgMembership('user-sso-test', 'org-sso-test')).toMatchObject({ role: 'read' })
  })

  it('rejects password-auth users on SSO provisioning', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertSsoProvider({ providerId: 'provider-sso-test', orgId: 'org-sso-test' })

    const response = await app.request('/private/sso/provision-user', {
      method: 'POST',
      headers: ssoHeaders,
      body: JSON.stringify({ user_id: 'user-password', email: 'user@managed.test', provider: 'email', providers: ['email'] }),
    }, env)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'sso_auth_required' })
    expect(await storage.getOrgMembership('user-password', 'org-sso-test')).toBeUndefined()
  })

  it('returns DNS verification state for configured SSO providers', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertSsoProvider({ providerId: 'provider-dns-test', orgId: 'org-sso-test', domain: 'managed.example' })

    const response = await app.request('/private/sso/verify-dns', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ provider_id: 'provider-dns-test' }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', provider_id: 'provider-dns-test', domain: 'managed.example', verified: true })
  })
})
