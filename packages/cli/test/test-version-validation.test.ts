import { describe, expect, it } from 'vitest'
import { requireValidReleaseVersion } from '../src/commands'

describe('[Capgo parity] release version validation', () => {
  it('uses strict semver without leading zeros', () => {
    expect(requireValidReleaseVersion('2.3.4')).toBe('2.3.4')
    expect(() => requireValidReleaseVersion('2.3.04')).toThrow('strict semver')
  })
})
