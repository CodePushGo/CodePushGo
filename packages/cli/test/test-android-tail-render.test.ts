import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-android-tail-render', () => {
  it('keeps Android native build flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('android')).toMatchObject({ platform: 'android', enabled: false })
    expect(nativeFlowFallback('android', 'test-android-tail-render')).toMatchObject({ status: 'disabled', platform: 'android', flow: 'test-android-tail-render' })
    expect(() => assertNativeBuildDisabled('android', 'test-android-tail-render')).toThrow(/out of scope/)
  })
})
