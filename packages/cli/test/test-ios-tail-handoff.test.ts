import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-ios-tail-handoff', () => {
  it('keeps ios native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('ios')).toMatchObject({ platform: 'ios', enabled: false })
    expect(nativeFlowFallback('ios', 'test-ios-tail-handoff')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-ios-tail-handoff' })
    expect(() => assertNativeBuildDisabled('ios', 'test-ios-tail-handoff')).toThrow(/out of scope/)
  })
})
