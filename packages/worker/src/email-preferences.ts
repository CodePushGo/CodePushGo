export interface EmailPreferences {
  usage_limit: boolean
  credit_usage: boolean
  onboarding: boolean
  weekly_stats: boolean
  monthly_stats: boolean
  deploy_stats_24h: boolean
  bundle_created: boolean
  bundle_deployed: boolean
  device_error: boolean
  channel_self_rejected: boolean
}

export type EmailPreferenceKey = keyof EmailPreferences

export const defaultEmailPreferences: EmailPreferences = {
  usage_limit: true,
  credit_usage: true,
  onboarding: true,
  weekly_stats: true,
  monthly_stats: true,
  deploy_stats_24h: true,
  bundle_created: true,
  bundle_deployed: true,
  device_error: true,
  channel_self_rejected: true,
}

const emailTypePreferenceMap: Record<string, EmailPreferenceKey> = {
  weekly_install_stats: 'weekly_stats',
  weekly_update_stats: 'weekly_stats',
  monthly_create_stats: 'monthly_stats',
  monthly_update_stats: 'monthly_stats',
  deploy_install_stats: 'deploy_stats_24h',
  usage_limit: 'usage_limit',
  credit_usage: 'credit_usage',
  onboarding: 'onboarding',
  bundle_created: 'bundle_created',
  bundle_deployed: 'bundle_deployed',
  device_error: 'device_error',
  channel_self_rejected: 'channel_self_rejected',
}

export function normalizeEmailPreferences(input: Partial<EmailPreferences> | null | undefined): EmailPreferences {
  return {
    ...defaultEmailPreferences,
    ...input,
  }
}

export function emailPreferenceKeyForType(type: string): EmailPreferenceKey | undefined {
  return emailTypePreferenceMap[type]
}

export function isEmailTypeEnabled(type: string, preferences: Partial<EmailPreferences> | null | undefined) {
  const key = emailPreferenceKeyForType(type)
  if (!key)
    return true
  return normalizeEmailPreferences(preferences)[key] !== false
}

export function updateEmailPreferences(current: Partial<EmailPreferences> | null | undefined, patch: Partial<EmailPreferences>) {
  return {
    ...normalizeEmailPreferences(current),
    ...patch,
  }
}
