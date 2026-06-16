export type AndroidOnboardingStep
  = | 'welcome'
    | 'keystore-method-select'
    | 'keystore-existing-path'
    | 'keystore-existing-store-password'
    | 'keystore-existing-detecting-alias'
    | 'keystore-existing-key-password'
    | 'keystore-new-alias'
    | 'keystore-new-password-method'
    | 'keystore-new-cn'
    | 'service-account-method-select'
    | 'sa-json-existing-path'
    | 'sa-json-validating'
    | 'google-sign-in'
    | 'play-developer-id-input'
    | 'gcp-projects-loading'
    | 'android-package-select'
    | 'gcp-setup-running'
    | 'saving-credentials'

export type KeystoreMethod = 'existing' | 'generate'
export type ServiceAccountMethod = 'existing' | 'generate'

export interface KeystoreReady {
  keystorePath: string
  alias: string
  isGenerated: boolean
}

export interface GoogleSignInComplete {
  email: string
  googleSubject?: string
  scope?: string
}

export interface PlayDeveloperAccountChoice {
  developerId?: string
  accountId?: string
  displayName?: string
}

export interface GcpProjectChoice {
  projectId: string
  projectNumber?: string
  displayName?: string
  createdByOnboarding?: boolean
}

export interface ServiceAccountProvisioned {
  email: string
  projectId: string
  uniqueId?: string
}

export interface PlayInviteProvisioned {
  developerId: string
  serviceAccountEmail: string
}

export interface AndroidPackageChoice {
  packageName: string
  source: 'capacitor-config' | 'gradle' | 'user-input'
}

export interface AndroidOnboardingProgress {
  platform: 'android'
  appId: string
  startedAt: string
  keystoreMethod?: KeystoreMethod
  keystoreExistingPath?: string
  keystoreAlias?: string
  keystoreStorePassword?: string
  keystoreKeyPassword?: string
  keystoreCommonName?: string
  serviceAccountForkSeen?: true
  serviceAccountMethod?: ServiceAccountMethod
  serviceAccountJsonPath?: string
  serviceAccountValidationSkipped?: boolean
  pendingNewProjectId?: string
  pendingNewProjectDisplayName?: string
  completedSteps: {
    keystoreReady?: KeystoreReady
    googleSignInComplete?: GoogleSignInComplete
    playAccountChosen?: PlayDeveloperAccountChoice
    gcpProjectChosen?: GcpProjectChoice
    androidPackageChosen?: AndroidPackageChoice
    serviceAccountProvisioned?: ServiceAccountProvisioned
    playInviteProvisioned?: PlayInviteProvisioned
  }
  _oauthRefreshToken?: string
  _keystoreBase64?: string
  _serviceAccountKeyBase64?: string
}
