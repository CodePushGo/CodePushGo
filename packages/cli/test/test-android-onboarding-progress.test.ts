import { describe, expect, it } from 'vitest'
import { getAndroidResumeStep, hasAnyOAuthProgress } from '../src/build/onboarding/android/progress'
import type { AndroidOnboardingProgress } from '../src/build/onboarding/android/types'

function keystoreReadyProgress(overrides: Partial<AndroidOnboardingProgress> = {}): AndroidOnboardingProgress {
  return {
    platform: 'android',
    appId: 'com.example.app',
    startedAt: '2026-05-22T00:00:00.000Z',
    keystoreMethod: 'generate',
    keystoreAlias: 'release',
    keystoreStorePassword: 'store-pass',
    _keystoreBase64: 'keystore-base64',
    completedSteps: {
      keystoreReady: {
        keystorePath: 'android/app/release.p12',
        alias: 'release',
        isGenerated: true,
      },
    },
    ...overrides,
  }
}

describe('[Capgo CLI parity] Android onboarding progress routing', () => {
  it('fresh runs return to service-account method select if quit before choosing', () => {
    expect(getAndroidResumeStep(keystoreReadyProgress({ serviceAccountForkSeen: true }))).toBe('service-account-method-select')
  })

  it('legacy progress without fork marker still resumes OAuth path', () => {
    expect(getAndroidResumeStep(keystoreReadyProgress())).toBe('google-sign-in')
  })

  it('existing service-account path resumes saving credentials after JSON is accepted', () => {
    expect(getAndroidResumeStep(keystoreReadyProgress({
      serviceAccountForkSeen: true,
      serviceAccountMethod: 'existing',
      _serviceAccountKeyBase64: 'service-account-json-base64',
    }))).toBe('saving-credentials')
  })

  it('fresh fork marker with OAuth progress keeps legacy OAuth resume', () => {
    const progress = keystoreReadyProgress({
      serviceAccountForkSeen: true,
      _oauthRefreshToken: 'refresh-token',
    })
    expect(hasAnyOAuthProgress(progress)).toBe(true)
    expect(getAndroidResumeStep(progress)).toBe('google-sign-in')
  })
})
