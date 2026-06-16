import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-macos-signing', () => {
  it('keeps macos native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('macos')).toMatchObject({ platform: 'macos', enabled: false })
    expect(nativeFlowFallback('macos', 'test-macos-signing')).toMatchObject({ status: 'disabled', platform: 'macos', flow: 'test-macos-signing' })
    expect(() => assertNativeBuildDisabled('macos', 'test-macos-signing')).toThrow(/out of scope/)
  })
})
