import { describe, expect, it } from 'vitest'
import { mapAndroidOnboardingError, mapIosOnboardingError, mapSaValidationKindToCategory } from '../../cli/src/build/onboarding/error-categories'

describe('[Capgo parity] mapIosOnboardingError', () => {
  it('maps App Store Connect status errors before step-derived categories', () => {
    expect(mapIosOnboardingError(Object.assign(new Error('Unauthorized'), { status: 401 }))).toBe('apple_api_unauthorized')
    expect(mapIosOnboardingError(Object.assign(new Error('Too many'), { status: 429 }))).toBe('apple_api_rate_limited')
    expect(mapIosOnboardingError(Object.assign(new Error('Unauthorized'), { status: 401 }), 'import-scanning')).toBe('apple_api_unauthorized')
  })

  it('maps structural iOS onboarding errors', () => {
    expect(mapIosOnboardingError(Object.assign(new Error('limit'), { name: 'CertificateLimitError' }))).toBe('cert_limit_reached')
    expect(mapIosOnboardingError(Object.assign(new Error('Profile create failed'), { phase: 'profile' }))).toBe('profile_creation_failed')
    expect(mapIosOnboardingError(Object.assign(new Error('Cannot parse P8'), { phase: 'p8' }))).toBe('p8_invalid')
  })

  it('maps import-flow step failures', () => {
    expect(mapIosOnboardingError(new Error('no identities'), 'import-scanning')).toBe('keychain_no_identities')
    expect(mapIosOnboardingError(new Error('wrong password'), 'import-exporting')).toBe('keychain_export_failed')
    expect(mapIosOnboardingError(new Error('fs error'), 'import-provide-profile-path')).toBe('profile_read_failed')
    expect(mapIosOnboardingError(new Error('no match'), 'import-pick-profile')).toBe('profile_no_match')
    expect(mapIosOnboardingError(new Error('no match'), 'import-no-match-recovery')).toBe('profile_no_match')
  })

  it('returns unknown for unmapped iOS errors', () => {
    expect(mapIosOnboardingError(new Error('something else'))).toBe('unknown')
    expect(mapIosOnboardingError('a string')).toBe('unknown')
    expect(mapIosOnboardingError(undefined)).toBe('unknown')
    expect(mapIosOnboardingError(new Error('???'), 'welcome')).toBe('unknown')
    expect(mapIosOnboardingError(new Error('???'), 'creating-certificate')).toBe('unknown')
  })
})

describe('[Capgo parity] mapAndroidOnboardingError', () => {
  it('maps Android onboarding error discriminators', () => {
    expect(mapAndroidOnboardingError(Object.assign(new Error('missing scopes'), { name: 'MissingScopesError' }))).toBe('google_oauth_failed')
    expect(mapAndroidOnboardingError(Object.assign(new Error('Bad keystore'), { phase: 'keystore' }))).toBe('keystore_invalid')
    expect(mapAndroidOnboardingError(Object.assign(new Error('Token refresh failed'), { phase: 'oauth' }))).toBe('google_oauth_failed')
    expect(mapAndroidOnboardingError(Object.assign(new Error('Bad ID'), { phase: 'play_account_id' }))).toBe('play_account_id_invalid')
  })

  it('returns unknown for unmapped Android errors', () => {
    expect(mapAndroidOnboardingError(new Error('???'))).toBe('unknown')
    expect(mapAndroidOnboardingError(null)).toBe('unknown')
  })
})

describe('[Capgo parity] mapSaValidationKindToCategory', () => {
  it('maps service-account validation kinds to analytics categories', () => {
    expect(mapSaValidationKindToCategory('shape-error')).toBe('sa_json_shape_invalid')
    expect(mapSaValidationKindToCategory('token-error')).toBe('sa_json_token_rejected')
    expect(mapSaValidationKindToCategory('no-app-access')).toBe('sa_json_no_app_access')
    expect(mapSaValidationKindToCategory('network-error')).toBe('sa_json_network_error')
  })
})
