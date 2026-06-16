import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-mobileprovision-parser', () => {
  it('keeps ios native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('ios')).toMatchObject({ platform: 'ios', enabled: false })
    expect(nativeFlowFallback('ios', 'test-mobileprovision-parser')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-mobileprovision-parser' })
    expect(() => assertNativeBuildDisabled('ios', 'test-mobileprovision-parser')).toThrow(/out of scope/)
  })
})
