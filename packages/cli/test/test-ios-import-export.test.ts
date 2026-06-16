import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-ios-import-export', () => {
  it('keeps ios native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('ios')).toMatchObject({ platform: 'ios', enabled: false })
    expect(nativeFlowFallback('ios', 'test-ios-import-export')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-ios-import-export' })
    expect(() => assertNativeBuildDisabled('ios', 'test-ios-import-export')).toThrow(/out of scope/)
  })
})
