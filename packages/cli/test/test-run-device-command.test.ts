import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, nativeFlowFallback } from '../src/native-build-scope'

describe('[Capgo parity] test-run-device-command', () => {
  it('routes native device/signing/tail behavior to the disabled-native-build contract', () => {
    expect(nativeFlowFallback('ios', 'test-run-device-command')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-run-device-command' })
    expect(() => assertNativeBuildDisabled('ios', 'test-run-device-command')).toThrow(/out of scope/)
  })
})
