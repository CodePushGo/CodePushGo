import { describe, expect, it } from 'vitest'
import { canUseApiKeyForWebhookOrgAction, type WebhookPolicyApiKey, type WebhookPolicyOrg } from '../src/webhook-apikey-policy'

const orgId = 'org-webhook-policy'
const now = new Date('2026-06-16T00:00:00.000Z')
const expiringOrg: WebhookPolicyOrg = { requireApiKeyExpiration: true, maxApiKeyExpirationDays: 30 }
const orgAdminBinding = { roleName: 'org_admin', scopeType: 'org', orgId } as const

function apiKey(input: Partial<WebhookPolicyApiKey> = {}): WebhookPolicyApiKey {
  return {
    expiresAt: null,
    bindings: [orgAdminBinding],
    ...input,
  }
}

describe('[Capgo parity] webhook endpoints enforce org API key expiration policy', () => {
  it.each([
    'listing',
    'creation',
    'deletion',
    'test delivery',
    'delivery retry',
  ])('rejects webhook %s for org non-expiring org key', () => {
    expect(canUseApiKeyForWebhookOrgAction({ orgId, org: expiringOrg, apiKey: apiKey(), now })).toEqual({
      allowed: false,
      status: 401,
      error: 'org_requires_expiring_key',
    })
  })

  it('rejects webhook actions when an org parent key attaches an expiring limited key', () => {
    expect(canUseApiKeyForWebhookOrgAction({
      orgId,
      org: expiringOrg,
      apiKey: apiKey({ expiresAt: new Date('2026-06-23T00:00:00.000Z').toISOString() }),
      limitedKeyId: '123',
      now,
    })).toEqual({
      allowed: false,
      status: 401,
      error: 'org_requires_expiring_key',
    })
  })

  it('allows webhook listing for a compliant expiring org key', () => {
    expect(canUseApiKeyForWebhookOrgAction({
      orgId,
      org: expiringOrg,
      apiKey: apiKey({ expiresAt: new Date('2026-06-23T00:00:00.000Z').toISOString() }),
      now,
    })).toEqual({ allowed: true })
  })

  it('allows delivery retry for a delegated API key with org_admin RBAC', () => {
    expect(canUseApiKeyForWebhookOrgAction({
      orgId,
      org: expiringOrg,
      apiKey: apiKey({
        expiresAt: new Date('2026-06-23T00:00:00.000Z').toISOString(),
        bindings: [{ roleName: 'org_admin', scopeType: 'org', orgId } as const],
      }),
      now,
    })).toEqual({ allowed: true })
  })

  it('rejects app-scoped keys for organization webhook management', () => {
    expect(canUseApiKeyForWebhookOrgAction({
      orgId,
      org: { requireApiKeyExpiration: false },
      apiKey: apiKey({ bindings: [{ roleName: 'app_admin', scopeType: 'app', orgId, appId: 'com.example.app' } as const] }),
      now,
    })).toEqual({
      allowed: false,
      status: 403,
      error: 'no_permission',
    })
  })
})