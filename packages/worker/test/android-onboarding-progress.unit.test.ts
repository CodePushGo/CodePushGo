import type { AndroidOnboardingProgress } from '../../cli/src/build/onboarding/android/types'
import { describe, expect, it } from 'vitest'
import { getAndroidResumeStep } from '../../cli/src/build/onboarding/android/progress'

function emptyProgress(): AndroidOnboardingProgress {
  return {
    platform: 'android',
    appId: 'com.test.app',
    startedAt: '2026-05-21T00:00:00.000Z',
    completedSteps: {},
  }
}

function withFullKeystore(p: AndroidOnboardingProgress): AndroidOnboardingProgress {
  return {
    ...p,
    keystoreAlias: 'release',
    keystoreStorePassword: 'pw',
    _keystoreBase64: 'base64-data',
    completedSteps: {
      ...p.completedSteps,
      keystoreReady: {
        keystorePath: 'release.p12',
        alias: 'release',
        isGenerated: true,
      },
    },
  }
}

function withGoogleSignIn(p: AndroidOnboardingProgress): AndroidOnboardingProgress {
  return {
    ...p,
    _oauthRefreshToken: 'refresh-token',
    completedSteps: {
      ...p.completedSteps,
      googleSignInComplete: {
        email: 'user@example.com',
        googleSubject: 'subject-123',
        scope: 'androidpublisher cloud-platform',
      },
    },
  }
}

function withPackageChosen(p: AndroidOnboardingProgress): AndroidOnboardingProgress {
  return {
    ...p,
    completedSteps: {
      ...p.completedSteps,
      androidPackageChosen: {
        packageName: 'com.test.app',
        source: 'gradle',
      },
    },
  }
}

describe('[Capgo parity] getAndroidResumeStep - base routing', () => {
  it('returns welcome for null progress', () => {
    expect(getAndroidResumeStep(null)).toBe('welcome')
  })

  it('returns keystore-method-select when keystore is not started', () => {
    expect(getAndroidResumeStep(emptyProgress())).toBe('keystore-method-select')
  })
})

describe('[Capgo parity] getAndroidResumeStep - legacy progress', () => {
  it('legacy progress with only keystore done routes to google-sign-in', () => {
    const p = withFullKeystore(emptyProgress())
    expect(getAndroidResumeStep(p)).toBe('google-sign-in')
  })

  it('legacy progress past google-sign-in continues to play-developer-id-input', () => {
    const p = withGoogleSignIn(withFullKeystore(emptyProgress()))
    expect(getAndroidResumeStep(p)).toBe('play-developer-id-input')
  })

  it('re-runs google-sign-in if the marker exists but the refresh token is missing', () => {
    const p = withFullKeystore(emptyProgress())
    p.completedSteps.googleSignInComplete = {
      email: 'user@example.com',
      googleSubject: 'subject-123',
      scope: 'androidpublisher cloud-platform',
    }
    expect(getAndroidResumeStep(p)).toBe('google-sign-in')
  })
})

describe('[Capgo parity] getAndroidResumeStep - import path', () => {
  it('routes to android-package-select first if no package chosen yet', () => {
    const p = withFullKeystore(emptyProgress())
    p.serviceAccountMethod = 'existing'
    expect(getAndroidResumeStep(p)).toBe('android-package-select')
  })

  it('routes to sa-json-existing-path after package chosen but no file picked', () => {
    const p = withPackageChosen(withFullKeystore(emptyProgress()))
    p.serviceAccountMethod = 'existing'
    expect(getAndroidResumeStep(p)).toBe('sa-json-existing-path')
  })

  it('routes to sa-json-validating after file picked but not yet accepted', () => {
    const p = withPackageChosen(withFullKeystore(emptyProgress()))
    p.serviceAccountMethod = 'existing'
    p.serviceAccountJsonPath = '/path/to/sa.json'
    expect(getAndroidResumeStep(p)).toBe('sa-json-validating')
  })

  it('routes to saving-credentials once the SA key bytes are accepted', () => {
    const p = withPackageChosen(withFullKeystore(emptyProgress()))
    p.serviceAccountMethod = 'existing'
    p.serviceAccountJsonPath = '/path/to/sa.json'
    p._serviceAccountKeyBase64 = 'base64-sa-bytes'
    expect(getAndroidResumeStep(p)).toBe('saving-credentials')
  })

  it('honors save-anyway resume even with serviceAccountValidationSkipped=true', () => {
    const p = withPackageChosen(withFullKeystore(emptyProgress()))
    p.serviceAccountMethod = 'existing'
    p.serviceAccountJsonPath = '/path/to/sa.json'
    p._serviceAccountKeyBase64 = 'base64-sa-bytes'
    p.serviceAccountValidationSkipped = true
    expect(getAndroidResumeStep(p)).toBe('saving-credentials')
  })
})

describe('[Capgo parity] getAndroidResumeStep - generate path', () => {
  it('generate explicitly set falls through to the OAuth-path rules', () => {
    const p = withFullKeystore(emptyProgress())
    p.serviceAccountMethod = 'generate'
    expect(getAndroidResumeStep(p)).toBe('google-sign-in')
  })

  it('generate continues to play-developer-id-input after sign-in', () => {
    const p = withGoogleSignIn(withFullKeystore(emptyProgress()))
    p.serviceAccountMethod = 'generate'
    expect(getAndroidResumeStep(p)).toBe('play-developer-id-input')
  })
})
