import { describe, expect, it } from 'vitest'
import { mapBuilderUploadError } from '../src/build/telemetry'
import { mapAndroidOnboardingError, mapIosOnboardingError } from '../src/build/onboarding/error-categories'

describe('[Capgo parity] onboarding telemetry classification', () => {
  it('classifies upload and platform onboarding errors without throwing', () => {
    expect(mapBuilderUploadError({ originalResponse: { getStatus: () => 401 } })).toBe('unauthorized')
    expect(mapBuilderUploadError({ originalResponse: { getStatus: () => 413 } })).toBe('payload_too_large')
    expect(mapBuilderUploadError({ originalResponse: { getStatus: () => 503 } })).toBe('storage_failure')
    expect(mapBuilderUploadError(new Error('offline'))).toBe('network_error')
    expect(mapIosOnboardingError(new Error('certificate expired'))).toBeTruthy()
    expect(mapAndroidOnboardingError(new Error('Google Play permission denied'))).toBeTruthy()
  })
})
