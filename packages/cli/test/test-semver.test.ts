import { describe, expect, it } from 'vitest'
import { isValidReleaseVersion } from '@codepushgo/shared'

describe('[Capgo parity] semver helper', () => {
  it('matches upload validation expectations', () => {
    expect(isValidReleaseVersion('1.0.0')).toBe(true)
    expect(isValidReleaseVersion('1.0.0-alpha+build.1')).toBe(true)
    expect(isValidReleaseVersion('v1.0.0')).toBe(false)
    expect(isValidReleaseVersion('1.0')).toBe(false)
    expect(isValidReleaseVersion('1.0.00')).toBe(false)
  })
})
