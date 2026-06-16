import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-provisioning-map-validation', () => {
  it('keeps ios native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('ios')).toMatchObject({ platform: 'ios', enabled: false })
    expect(nativeFlowFallback('ios', 'test-provisioning-map-validation')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-provisioning-map-validation' })
    expect(() => assertNativeBuildDisabled('ios', 'test-provisioning-map-validation')).toThrow(/out of scope/)
  })
})
