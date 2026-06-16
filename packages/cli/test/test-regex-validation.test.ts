import { describe, expect, it } from 'vitest'
import { isValidReleaseVersion } from '@codepushgo/shared'

describe('[Capgo parity] semver regex validation', () => {
  it('rejects malformed versions with leading zeros', () => {
    for (const version of ['1.5.00', '1.05.0', '01.5.0', '1.5.0.0', '1.5'])
      expect(isValidReleaseVersion(version), version).toBe(false)
  })

  it('accepts strict semver versions', () => {
    for (const version of ['1.5.0', '0.0.0', '1.5.0-alpha', '1.5.0+build'])
      expect(isValidReleaseVersion(version), version).toBe(true)
  })
})
