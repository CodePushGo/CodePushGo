import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-asc-key-protocol', () => {
  it('keeps ios native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('ios')).toMatchObject({ platform: 'ios', enabled: false })
    expect(nativeFlowFallback('ios', 'test-asc-key-protocol')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-asc-key-protocol' })
    expect(() => assertNativeBuildDisabled('ios', 'test-asc-key-protocol')).toThrow(/out of scope/)
  })
})
