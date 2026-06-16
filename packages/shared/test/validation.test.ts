import { describe, expect, it } from 'vitest'
import { isValidAppId, isValidReleaseVersion } from '../src/validation'

describe('Capgo-compatible validation helpers', () => {
  it('accepts valid reverse-domain app ids', () => {
    for (const appId of ['com.example.app', 'ee.forgr.demoapp', 'com.company.product-name', 'com.company.product_name', 'io.ionic.starter'])
      expect(isValidAppId(appId), appId).toBe(true)
  })

  it('rejects invalid app ids', () => {
    for (const appId of ['', 'app', 'app_name', '.com.example', 'com.example.', 'com..example', 'com.example.app+', '[appid]', null, undefined])
      expect(isValidAppId(appId), String(appId)).toBe(false)
  })

  it('accepts strict semver release versions without a leading v', () => {
    for (const version of [
      '1.0.0',
      '0.0.0',
      '10.20.30',
      '1.0.0-alpha.1',
      '1.0.0-alpha-.-beta',
      '1.0.0+build.1',
      '1.0.0-beta.2+build.123',
      '1.2.3----RC-SNAPSHOT.12.9.1--.12+788',
      `1.0.0-alpha.${'a'.repeat(100)}`,
    ])
      expect(isValidReleaseVersion(version), version).toBe(true)
  })

  it('rejects malformed release versions', () => {
    for (const version of [
      'v1.2.3',
      'V1.2.3',
      '1',
      '1.2',
      '1.2.',
      '1..3',
      'hello, world',
      '1.2.3.4',
      '01.0.0',
      '1.02.0',
      '1.0.03',
      ' ',
      ' 1.0.0 ',
      '1.0.0-',
      '1.0.0-..',
      '1.0.0-01',
      '1.0.0+',
      '1.0.0+_build',
      '-1.0.0',
      '1.0.0!',
      '>=1.0.0',
      '^1.0.0',
      'latest',
      '1.0.0\x00',
      '1.0.0\n',
    ])
      expect(isValidReleaseVersion(version), JSON.stringify(version)).toBe(false)
  })
})
