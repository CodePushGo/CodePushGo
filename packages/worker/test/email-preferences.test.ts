import { describe, expect, it } from 'vitest'
import { defaultEmailPreferences, emailPreferenceKeyForType, isEmailTypeEnabled, normalizeEmailPreferences, updateEmailPreferences } from '../src/email-preferences'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] email preferences', () => {
  it.concurrent('has email_preferences column with default values', () => {
    expect(migrationSql).toContain('email_preferences JSONB NOT NULL')
    expect(normalizeEmailPreferences({})).toEqual(defaultEmailPreferences)
    expect(defaultEmailPreferences).toMatchObject({
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
    })
  })

  it.concurrent('allows updating individual email preferences', () => {
    const prefs = updateEmailPreferences(defaultEmailPreferences, { weekly_stats: false })

    expect(prefs.weekly_stats).toBe(false)
    expect(prefs.usage_limit).toBe(true)
  })

  it.concurrent('allows toggling preferences back to true', () => {
    const disabled = updateEmailPreferences(defaultEmailPreferences, { weekly_stats: false })
    const enabled = updateEmailPreferences(disabled, { weekly_stats: true })

    expect(enabled.weekly_stats).toBe(true)
  })

  it.concurrent('maps cron email types to preference keys', () => {
    expect(emailPreferenceKeyForType('weekly_install_stats')).toBe('weekly_stats')
    expect(emailPreferenceKeyForType('monthly_create_stats')).toBe('monthly_stats')
    expect(emailPreferenceKeyForType('deploy_install_stats')).toBe('deploy_stats_24h')
  })

  it.concurrent('skips stats emails when matching preferences are disabled', () => {
    expect(isEmailTypeEnabled('weekly_install_stats', { weekly_stats: false })).toBe(false)
    expect(isEmailTypeEnabled('monthly_create_stats', { monthly_stats: false })).toBe(false)
    expect(isEmailTypeEnabled('deploy_install_stats', { deploy_stats_24h: false })).toBe(false)
  })

  it.concurrent('allows stats emails when matching preferences are enabled or missing', () => {
    expect(isEmailTypeEnabled('weekly_install_stats', { weekly_stats: true })).toBe(true)
    expect(isEmailTypeEnabled('monthly_create_stats', {})).toBe(true)
    expect(isEmailTypeEnabled('unknown_email_type', { weekly_stats: false })).toBe(true)
  })

  it.concurrent('allows disabling multiple preferences at once', () => {
    const prefs = updateEmailPreferences(defaultEmailPreferences, {
      credit_usage: false,
      device_error: false,
      usage_limit: false,
    })

    expect(prefs.usage_limit).toBe(false)
    expect(prefs.credit_usage).toBe(false)
    expect(prefs.device_error).toBe(false)
    expect(prefs.onboarding).toBe(true)
    expect(prefs.bundle_created).toBe(true)
  })

  it.concurrent('can filter users by specific preference values after normalization', () => {
    const prefs = updateEmailPreferences(defaultEmailPreferences, { bundle_deployed: false })

    expect(prefs.bundle_deployed).toBe(false)
  })
})
