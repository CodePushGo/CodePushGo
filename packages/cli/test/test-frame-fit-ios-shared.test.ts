import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-frame-fit-ios-shared', () => {
  it('keeps ios native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('ios')).toMatchObject({ platform: 'ios', enabled: false })
    expect(nativeFlowFallback('ios', 'test-frame-fit-ios-shared')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-frame-fit-ios-shared' })
    expect(() => assertNativeBuildDisabled('ios', 'test-frame-fit-ios-shared')).toThrow(/out of scope/)
  })
})
