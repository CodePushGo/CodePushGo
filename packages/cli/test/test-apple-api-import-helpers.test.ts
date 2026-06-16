import { describe, expect, it } from 'vitest'
import { assertNativeBuildDisabled, isNativeBuildFlowEnabled, nativeFlowFallback, nativeBuildSupportStatus } from '../src/native-build-scope'

describe('[Capgo parity] test-apple-api-import-helpers', () => {
  it('keeps ios native build/store flow explicitly disabled for the RN MVP', () => {
    expect(isNativeBuildFlowEnabled()).toBe(false)
    expect(nativeBuildSupportStatus('ios')).toMatchObject({ platform: 'ios', enabled: false })
    expect(nativeFlowFallback('ios', 'test-apple-api-import-helpers')).toMatchObject({ status: 'disabled', platform: 'ios', flow: 'test-apple-api-import-helpers' })
    expect(() => assertNativeBuildDisabled('ios', 'test-apple-api-import-helpers')).toThrow(/out of scope/)
  })
})
