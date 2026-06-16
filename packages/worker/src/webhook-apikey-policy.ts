import type { ApiKeyBindingRecord } from '@codepushgo/shared'

export interface WebhookPolicyApiKey {
  expiresAt?: string | null
  bindings: ApiKeyBindingRecord[]
}

export interface WebhookPolicyOrg {
  requireApiKeyExpiration?: boolean
  maxApiKeyExpirationDays?: number | null
}

export interface WebhookPolicyRequest {
  orgId: string
  org: WebhookPolicyOrg
  apiKey: WebhookPolicyApiKey
  limitedKeyId?: string | null
  now?: Date
}

export interface WebhookPolicyDecision {
  allowed: boolean
  status?: number
  error?: string
}

function hasOrgAdminBinding(apiKey: WebhookPolicyApiKey, orgId: string) {
  return apiKey.bindings.some(binding => binding.scopeType === 'org' && binding.orgId === orgId && (binding.roleName === 'org_admin' || binding.roleName === 'org_super_admin'))
}

function isCompliantExpiringKey(apiKey: WebhookPolicyApiKey, org: WebhookPolicyOrg, now = new Date()) {
  if (!org.requireApiKeyExpiration)
    return true
  if (!apiKey.expiresAt)
    return false

  const expiresAt = Date.parse(apiKey.expiresAt)
  if (Number.isNaN(expiresAt) || expiresAt <= now.getTime())
    return false

  if (org.maxApiKeyExpirationDays == null)
    return true

  const maxExpiresAt = now.getTime() + org.maxApiKeyExpirationDays * 24 * 60 * 60 * 1000
  return expiresAt <= maxExpiresAt
}

export function canUseApiKeyForWebhookOrgAction(request: WebhookPolicyRequest): WebhookPolicyDecision {
  if (!hasOrgAdminBinding(request.apiKey, request.orgId))
    return { allowed: false, status: 403, error: 'no_permission' }

  if (request.limitedKeyId)
    return { allowed: false, status: 401, error: 'org_requires_expiring_key' }

  if (!isCompliantExpiringKey(request.apiKey, request.org, request.now))
    return { allowed: false, status: 401, error: 'org_requires_expiring_key' }

  return { allowed: true }
}