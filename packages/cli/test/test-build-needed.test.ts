import { describe, expect, it } from 'vitest'
import { getCompatibilityDetails, summarizeUploadCompatibility } from '../src/bundle/compatibility'
import { decideBuilderCtaSurface, shouldBlockIncompatibleUpload } from '../src/bundle/builder-cta'

describe('[Capgo parity] React Native build-needed adaptation', () => {
  it('classifies native compatibility entries that require a store build', () => {
    expect(getCompatibilityDetails({ name: 'new-native-module', localVersion: '1.0.0' })).toMatchObject({
      compatible: false,
      reasons: ['new_plugin'],
    })

    expect(getCompatibilityDetails({ name: 'same-module', localVersion: '^1.2.0', remoteVersion: '^1.4.0' })).toMatchObject({ compatible: true })
    expect(getCompatibilityDetails({ name: 'major-module', localVersion: '2.0.0', remoteVersion: '1.0.0' })).toMatchObject({
      compatible: false,
      reasons: ['version_mismatch'],
    })
  })

  it('summarizes incompatible React Native bundle uploads', () => {
    expect(summarizeUploadCompatibility(undefined)).toEqual({ result: 'skipped', incompatibleCount: 0, reasons: [] })
    expect(summarizeUploadCompatibility([
      { name: 'compatible', localVersion: '1.0.0', remoteVersion: '1.0.0' },
      { name: 'native-change', localVersion: '1.0.0', remoteVersion: '1.0.0', localIosChecksum: 'new', remoteIosChecksum: 'old' },
    ])).toEqual({ result: 'incompatible', incompatibleCount: 1, reasons: ['ios_code_changed'] })
  })

  it('blocks unsafe uploads unless the native gate is explicitly bypassed', () => {
    expect(shouldBlockIncompatibleUpload({ incompatible: true })).toBe(true)
    expect(shouldBlockIncompatibleUpload({ incompatible: true, forceNativeBuild: true })).toBe(false)
    expect(shouldBlockIncompatibleUpload({ incompatible: true, disableNativeBuildGate: true })).toBe(false)
    expect(shouldBlockIncompatibleUpload({ incompatible: false })).toBe(false)
  })

  it('selects the adapted builder CTA surface from compatibility state', () => {
    expect(decideBuilderCtaSurface({ incompatible: false, interactive: true, hasCredentials: false })).toBe('skip')
    expect(decideBuilderCtaSurface({ incompatible: true, interactive: false, hasCredentials: false })).toBe('ci-ad')
    expect(decideBuilderCtaSurface({ incompatible: true, interactive: true, hasCredentials: false })).toBe('prompt-onboarding')
    expect(decideBuilderCtaSurface({ incompatible: true, interactive: true, hasCredentials: true })).toBe('prompt-build')
  })
})
