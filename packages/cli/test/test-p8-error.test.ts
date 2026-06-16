import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, nativeFlowFallback } from '../src/native-build-scope'

describe('[Capgo parity] test-p8-error', () => {
  it('routes native device/signing/tail behavior to the disabled-native-build contract', () => {
    expect(nativeFlowFallback('ios', 'test-p8-error')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-p8-error' })
    expect(() => assertNativeBuildDisabled('ios', 'test-p8-error')).toThrow(/out of scope/)
  })
})
