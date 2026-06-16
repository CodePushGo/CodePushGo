import type { AndroidOnboardingProgress, AndroidOnboardingStep } from './types'

function keystoreFullyValid(progress: AndroidOnboardingProgress): boolean {
  return !!(
    progress.completedSteps.keystoreReady
    && progress.keystoreAlias
    && progress.keystoreStorePassword
    && progress._keystoreBase64
  )
}

function keystoreResumeStep(progress: AndroidOnboardingProgress): AndroidOnboardingStep {
  if (progress.keystoreMethod === 'existing') {
    if (progress.keystoreAlias && progress.keystoreStorePassword && progress.keystoreExistingPath)
      return 'keystore-existing-key-password'
    if (progress.keystoreStorePassword && progress.keystoreExistingPath)
      return 'keystore-existing-detecting-alias'
    if (progress.keystoreExistingPath)
      return 'keystore-existing-store-password'
    return 'keystore-existing-path'
  }
  if (progress.keystoreMethod === 'generate') {
    if (progress.keystoreStorePassword && progress.keystoreAlias)
      return 'keystore-new-cn'
    if (progress.keystoreAlias)
      return 'keystore-new-password-method'
    return 'keystore-new-alias'
  }
  return 'keystore-method-select'
}

export function hasAnyOAuthProgress(progress: AndroidOnboardingProgress): boolean {
  return !!(
    progress.completedSteps.googleSignInComplete
    || progress.completedSteps.playAccountChosen
    || progress.completedSteps.gcpProjectChosen
    || progress.completedSteps.androidPackageChosen
    || progress._oauthRefreshToken
  )
}

export function getAndroidResumeStep(progress: AndroidOnboardingProgress | null): AndroidOnboardingStep {
  if (!progress)
    return 'welcome'

  const { completedSteps } = progress

  if (!keystoreFullyValid(progress))
    return keystoreResumeStep(progress)

  if (progress.serviceAccountMethod === 'existing') {
    if (progress._serviceAccountKeyBase64)
      return 'saving-credentials'
    if (!completedSteps.androidPackageChosen)
      return 'android-package-select'
    if (progress.serviceAccountJsonPath)
      return 'sa-json-validating'
    return 'sa-json-existing-path'
  }

  if (progress.serviceAccountForkSeen && progress.serviceAccountMethod === undefined && !hasAnyOAuthProgress(progress))
    return 'service-account-method-select'

  if (!completedSteps.googleSignInComplete || !progress._oauthRefreshToken)
    return 'google-sign-in'

  if (!completedSteps.playAccountChosen)
    return 'play-developer-id-input'

  if (!completedSteps.gcpProjectChosen)
    return 'gcp-projects-loading'

  if (!completedSteps.androidPackageChosen)
    return 'android-package-select'

  if (!completedSteps.serviceAccountProvisioned || !completedSteps.playInviteProvisioned || !progress._serviceAccountKeyBase64)
    return 'gcp-setup-running'

  return 'saving-credentials'
}
