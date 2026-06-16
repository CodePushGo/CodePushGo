import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-android-oauth', () => {
  it('keeps Android native build flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('android')).toMatchObject({ platform: 'android', enabled: false })
    expect(nativeFlowFallback('android', 'test-android-oauth')).toMatchObject({ status: 'disabled', platform: 'android', flow: 'test-android-oauth' })
    expect(() => assertNativeBuildDisabled('android', 'test-android-oauth')).toThrow(/out of scope/)
  })
})
