import { describe, expect, it } from 'vitest'
import { compareVersions, isVersionGreater, parseVersion } from '../src/semver'

describe('semver helpers', () => {
  it('parses plain and v-prefixed versions', () => {
    expect(parseVersion('1.2.3')).toMatchObject({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('v2.0.1')).toMatchObject({ major: 2, minor: 0, patch: 1 })
  })

  it('compares update candidates', () => {
    expect(isVersionGreater('1.0.1', '1.0.0')).toBe(true)
    expect(isVersionGreater('1.0.0', '1.0.1')).toBe(false)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('treats stable release as newer than prerelease', () => {
    expect(isVersionGreater('1.0.0', '1.0.0-beta.1')).toBe(true)
  })
})
