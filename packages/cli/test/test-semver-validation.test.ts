import { describe, expect, it } from 'vitest'
import { compareVersions, isValidReleaseVersion, parseVersion } from '@codepushgo/shared'
import { requireValidReleaseVersion } from '../src/commands'

describe('[Capgo parity] semver validation', () => {
  it('accepts strict release versions and rejects loose CLI input', () => {
    expect(isValidReleaseVersion('1.2.3')).toBe(true)
    expect(isValidReleaseVersion('1.2.3-beta.1+build.5')).toBe(true)
    expect(isValidReleaseVersion('v1.2.3')).toBe(false)
    expect(isValidReleaseVersion('1.2')).toBe(false)
    expect(() => requireValidReleaseVersion('v1.2.3')).toThrow(/strict semver/)
  })

  it('parses and compares versions for update prompts', () => {
    expect(parseVersion('v1.2.3')?.major).toBe(1)
    expect(compareVersions('1.2.4', '1.2.3')).toBeGreaterThan(0)
    expect(compareVersions('1.2.3-beta', '1.2.3')).toBeLessThan(0)
  })
})
