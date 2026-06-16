import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-android-tui-sequencing', () => {
  it('keeps Android native build flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('android')).toMatchObject({ platform: 'android', enabled: false })
    expect(nativeFlowFallback('android', 'test-android-tui-sequencing')).toMatchObject({ status: 'disabled', platform: 'android', flow: 'test-android-tui-sequencing' })
    expect(() => assertNativeBuildDisabled('android', 'test-android-tui-sequencing')).toThrow(/out of scope/)
  })
})
