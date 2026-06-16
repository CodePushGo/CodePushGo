import { describe, expect, it } from 'vitest'
import { getPlatformDirFromReactNativeConfig, normalizeRelPath } from '../src/platform-paths'

describe('[Capgo parity] platform path helpers', () => {
  it('normalizes relative paths', () => {
    expect(normalizeRelPath('android/')).toBe('android')
    expect(normalizeRelPath('././android/')).toBe('android')
    expect(normalizeRelPath('projects\\app\\android\\')).toBe('projects/app/android')
    expect(normalizeRelPath('  .  ')).toBe('')
  })

  it('uses configured React Native platform paths with defaults', () => {
    expect(getPlatformDirFromReactNativeConfig({ android: { path: 'projects/app/android' } }, 'android')).toBe('projects/app/android')
    expect(getPlatformDirFromReactNativeConfig({ ios: { path: '.' } }, 'ios')).toBe('ios')
  })
})
