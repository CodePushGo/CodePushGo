export type OnboardingErrorCategory
  = | 'apple_api_unauthorized'
    | 'apple_api_rate_limited'
    | 'profile_creation_failed'
    | 'p8_invalid'
    | 'cert_limit_reached'
    | 'keychain_no_identities'
    | 'keychain_export_failed'
    | 'profile_read_failed'
    | 'profile_no_match'
    | 'unknown'

export type AndroidOnboardingErrorCategory
  = | 'keystore_invalid'
    | 'google_oauth_failed'
    | 'play_account_id_invalid'
    | 'sa_json_shape_invalid'
    | 'sa_json_token_rejected'
    | 'sa_json_no_app_access'
    | 'sa_json_network_error'
    | 'unknown'

export type IosOnboardingFailedStep
  = | 'import-scanning'
    | 'import-exporting'
    | 'import-provide-profile-path'
    | 'import-pick-profile'
    | 'import-no-match-recovery'
    | string

export type ServiceAccountValidationKind = 'shape-error' | 'token-error' | 'no-app-access' | 'network-error'

interface MaybeStatus {
  status?: unknown
}

interface MaybePhase {
  phase?: unknown
}

interface MaybeName {
  name?: unknown
}

function getStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object')
    return undefined
  const candidate = (error as MaybeStatus).status
  return typeof candidate === 'number' ? candidate : undefined
}

function getPhase(error: unknown): string | undefined {
  if (!error || typeof error !== 'object')
    return undefined
  const candidate = (error as MaybePhase).phase
  return typeof candidate === 'string' ? candidate : undefined
}

function getErrorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object')
    return undefined
  const candidate = (error as MaybeName).name
  return typeof candidate === 'string' ? candidate : undefined
}

export function mapIosOnboardingError(error: unknown, failedStep?: IosOnboardingFailedStep): OnboardingErrorCategory {
  if (getErrorName(error) === 'CertificateLimitError')
    return 'cert_limit_reached'

  const status = getStatus(error)
  if (status === 401)
    return 'apple_api_unauthorized'
  if (status === 429)
    return 'apple_api_rate_limited'

  const phase = getPhase(error)
  if (phase === 'profile')
    return 'profile_creation_failed'
  if (phase === 'p8')
    return 'p8_invalid'

  if (failedStep === 'import-scanning')
    return 'keychain_no_identities'
  if (failedStep === 'import-exporting')
    return 'keychain_export_failed'
  if (failedStep === 'import-provide-profile-path')
    return 'profile_read_failed'
  if (failedStep === 'import-pick-profile' || failedStep === 'import-no-match-recovery')
    return 'profile_no_match'

  return 'unknown'
}

export function mapAndroidOnboardingError(error: unknown): AndroidOnboardingErrorCategory {
  if (getErrorName(error) === 'MissingScopesError')
    return 'google_oauth_failed'

  const phase = getPhase(error)
  if (phase === 'keystore')
    return 'keystore_invalid'
  if (phase === 'oauth')
    return 'google_oauth_failed'
  if (phase === 'play_account_id')
    return 'play_account_id_invalid'

  return 'unknown'
}

export function mapSaValidationKindToCategory(kind: ServiceAccountValidationKind): AndroidOnboardingErrorCategory {
  switch (kind) {
    case 'shape-error':
      return 'sa_json_shape_invalid'
    case 'token-error':
      return 'sa_json_token_rejected'
    case 'no-app-access':
      return 'sa_json_no_app_access'
    case 'network-error':
      return 'sa_json_network_error'
  }
}
