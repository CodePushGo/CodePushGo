import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, nativeFlowFallback } from '../src/native-build-scope'

describe('[Capgo parity] test-tail-engine-shared', () => {
  it('routes native device/signing/tail behavior to the disabled-native-build contract', () => {
    expect(nativeFlowFallback('ios', 'test-tail-engine-shared')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-tail-engine-shared' })
    expect(() => assertNativeBuildDisabled('ios', 'test-tail-engine-shared')).toThrow(/out of scope/)
  })
})
