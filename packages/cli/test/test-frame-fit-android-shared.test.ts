import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-frame-fit-android-shared', () => {
  it('keeps Android native build flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('android')).toMatchObject({ platform: 'android', enabled: false })
    expect(nativeFlowFallback('android', 'test-frame-fit-android-shared')).toMatchObject({ status: 'disabled', platform: 'android', flow: 'test-frame-fit-android-shared' })
    expect(() => assertNativeBuildDisabled('android', 'test-frame-fit-android-shared')).toThrow(/out of scope/)
  })
})
