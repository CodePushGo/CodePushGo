import { describe, expect, it } from 'vitest'
import { shouldBlockIncompatibleUpload } from '../src/bundle/builder-cta'

describe('[Capgo parity] fail-on-incompatible upload gate', () => {
  it('does not block compatible uploads', () => {
    expect(shouldBlockIncompatibleUpload({ incompatible: false, failOnIncompatible: true })).toBe(false)
  })

  it('preserves the default native metadata safety gate', () => {
    expect(shouldBlockIncompatibleUpload({ incompatible: true })).toBe(true)
    expect(shouldBlockIncompatibleUpload({ incompatible: true, forceNativeBuild: true })).toBe(false)
    expect(shouldBlockIncompatibleUpload({ incompatible: true, disableNativeBuildGate: true })).toBe(false)
  })

  it('only blocks fail-on-incompatible when the user continues without a build path', () => {
    expect(shouldBlockIncompatibleUpload({ incompatible: true, failOnIncompatible: false, builderAction: 'continue' })).toBe(false)
    expect(shouldBlockIncompatibleUpload({ incompatible: true, failOnIncompatible: true, builderAction: 'continue' })).toBe(true)
    expect(shouldBlockIncompatibleUpload({ incompatible: true, failOnIncompatible: true, builderAction: 'launch-build' })).toBe(false)
    expect(shouldBlockIncompatibleUpload({ incompatible: true, failOnIncompatible: true, builderAction: 'launch-onboarding' })).toBe(false)
  })
})
