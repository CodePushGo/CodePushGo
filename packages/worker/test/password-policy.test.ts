import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const strictPolicy = {
  enabled: true,
  min_length: 10,
  require_uppercase: true,
  require_number: true,
  require_special: true,
}

describe('[Capgo parity] password Policy Configuration via Worker', () => {
  it('persists, updates, disables, and rejects invalid password policy configuration', async () => {
    const { app, env } = testApp()
    const orgId = crypto.randomUUID()

    const create = await app.request('https://api.test/organization', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: orgId, name: 'Password Policy Org', password_policy_config: strictPolicy }),
    }, env)
    expect(create.status).toBe(200)
    expect(await create.json()).toMatchObject({ password_policy_config: strictPolicy, password_has_access: true })

    const partialPolicy = {
      enabled: true,
      min_length: 8,
      require_uppercase: false,
      require_number: true,
      require_special: false,
    }
    const update = await app.request('https://api.test/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ orgId, password_policy_config: partialPolicy }),
    }, env)
    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({ password_policy_config: partialPolicy })

    const reject = await app.request('https://api.test/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ orgId, password_policy_config: { ...strictPolicy, min_length: 73 } }),
    }, env)
    expect(reject.status).toBe(400)
    expect(await reject.json()).toMatchObject({ error: 'invalid_body' })

    const disable = await app.request('https://api.test/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ orgId, password_policy_config: { enabled: false, min_length: 8 } }),
    }, env)
    expect(disable.status).toBe(200)
    expect(await disable.json()).toMatchObject({ password_policy_config: { enabled: false, min_length: 8 } })
  })
})

describe('[POST] /private/validate_password_compliance', () => {
  it('validates request shape, origin, membership, policy failures, and success', async () => {
    const { app, env, storage } = testApp()
    const orgId = crypto.randomUUID()
    await storage.upsertOrganization({ id: orgId, name: 'Password Validate Org', passwordPolicyConfig: strictPolicy })
    await storage.upsertOrgMembership({ orgId, userId: 'user-1', email: 'member@example.com', role: 'super_admin' })

    const missingEmail = await app.request('https://api.test/private/validate_password_compliance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'TestPassword123!', org_id: orgId }),
    }, env)
    expect(missingEmail.status).toBe(400)
    expect(await missingEmail.json()).toMatchObject({ error: 'invalid_body' })

    const forbiddenOrigin = await app.request('https://api.test/private/validate_password_compliance', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://malicious.example' },
      body: JSON.stringify({ email: 'member@example.com', password: 'TestPassword123!', org_id: orgId }),
    }, env)
    expect(forbiddenOrigin.status).toBe(403)
    expect(await forbiddenOrigin.json()).toMatchObject({ error: 'forbidden_origin' })

    const notMember = await app.request('https://api.test/private/validate_password_compliance', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'capacitor://localhost' },
      body: JSON.stringify({ email: 'outsider@example.com', password: 'TestPassword123!', org_id: orgId }),
    }, env)
    expect(notMember.status).toBe(403)
    expect(await notMember.json()).toMatchObject({ error: 'not_member' })

    const weakPassword = await app.request('https://api.test/private/validate_password_compliance', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: 'member@example.com', password: 'weak', org_id: orgId }),
    }, env)
    expect(weakPassword.status).toBe(400)
    const weakBody = await weakPassword.json() as { error?: string, errors?: string[] }
    expect(weakBody.error).toBe('password_does_not_meet_policy')
    expect(weakBody.errors).toContain('Password must be at least 10 characters')

    const success = await app.request('https://api.test/private/validate_password_compliance', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'ionic://localhost' },
      body: JSON.stringify({ email: 'member@example.com', password: 'StrongPass123!', org_id: orgId }),
    }, env)
    expect(success.status).toBe(200)
    expect(await success.json()).toMatchObject({ status: 'ok' })
  })

  it('returns no_policy when the organization has no enabled policy', async () => {
    const { app, env, storage } = testApp()
    const orgId = crypto.randomUUID()
    await storage.upsertOrganization({ id: orgId, name: 'No Policy Org', passwordPolicyConfig: null })
    await storage.upsertOrgMembership({ orgId, userId: 'user-1', email: 'member@example.com', role: 'super_admin' })

    const response = await app.request('https://api.test/private/validate_password_compliance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'member@example.com', password: 'StrongPass123!', org_id: orgId }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'no_policy' })
  })
})
