import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

const ssoHeaders = {
  authorization: 'Bearer supabase-session-token',
  'content-type': 'application/json',
}

describe('[Capgo parity] auth guard SSO provisioning', () => {
  it('provisions an SSO session into its configured organization', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertSsoProvider({ providerId: 'provider-123', orgId: 'org-123', domain: 'managed.test' })

    const response = await app.request('https://api.test/private/sso/provision-user', {
      method: 'POST',
      headers: ssoHeaders,
      body: JSON.stringify({
        user: {
          id: 'user-123',
          email: 'user@managed.test',
          user_metadata: { first_name: 'Managed', last_name: 'User' },
          app_metadata: { provider: 'sso:provider-123', providers: ['sso:provider-123'] },
        },
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      merged: false,
      already_member: false,
      org_id: 'org-123',
      user_id: 'user-123',
    })
    await expect(storage.getUser('user-123')).resolves.toMatchObject({ email: 'user@managed.test', firstName: 'Managed', lastName: 'User' })
    await expect(storage.getOrgMembership('user-123', 'org-123')).resolves.toMatchObject({ role: 'read' })
  })

  it('returns already_member for a user that is already provisioned', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertSsoProvider({ providerId: 'provider-123', orgId: 'org-123' })

    const body = JSON.stringify({
      user_id: 'user-123',
      email: 'user@managed.test',
      provider: 'sso:provider-123',
      providers: ['sso:provider-123'],
    })

    await app.request('https://api.test/private/sso/provision-user', { method: 'POST', headers: ssoHeaders, body }, env)
    const response = await app.request('https://api.test/private/sso/provision-user', { method: 'POST', headers: ssoHeaders, body }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, already_member: true })
  })

  it('rejects non-SSO users instead of provisioning them into an organization', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertSsoProvider({ providerId: 'provider-123', orgId: 'org-123' })

    const response = await app.request('https://api.test/private/sso/provision-user', {
      method: 'POST',
      headers: ssoHeaders,
      body: JSON.stringify({
        user_id: 'user-123',
        email: 'user@managed.test',
        provider: 'email',
        providers: ['email'],
      }),
    }, env)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'sso_auth_required' })
    await expect(storage.getOrgMembership('user-123', 'org-123')).resolves.toBeUndefined()
  })

  it('fails provisioning when the authenticated SSO provider has no configured organization', async () => {
    const { app, env } = testApp()

    const response = await app.request('https://api.test/private/sso/provision-user', {
      method: 'POST',
      headers: ssoHeaders,
      body: JSON.stringify({
        user_id: 'user-123',
        email: 'user@managed.test',
        provider: 'sso:missing-provider',
        providers: ['sso:missing-provider'],
      }),
    }, env)

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: 'provider_not_found' })
  })

  it('keeps SSO provisioning tables in the single Supabase migration', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.users')
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.org_users')
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.sso_providers')
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sso_providers TO service_role')
  })
})
