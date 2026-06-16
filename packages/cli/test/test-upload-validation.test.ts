import { describe, expect, it } from 'vitest'
import { requireValidReleaseVersion } from '../src/commands'

describe('[Capgo parity] upload version validation', () => {
  it('rejects malformed semver versions before upload', () => {
    for (const version of ['1.5.00', '1.05.0', '01.5.0', 'v1.5.0', 'latest'])
      expect(() => requireValidReleaseVersion(version), version).toThrow('strict semver')
  })

  it('accepts strict semver with prerelease and build metadata', () => {
    for (const version of ['1.5.0', '0.0.1', '1.5.0-beta.1', '1.5.0+20260616'])
      expect(requireValidReleaseVersion(version)).toBe(version)
  })
})
