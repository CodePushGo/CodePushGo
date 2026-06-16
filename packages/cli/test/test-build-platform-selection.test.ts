import { describe, expect, it } from 'vitest'
import { resolvePlatform } from '../src/platform'

describe('[Capgo parity] React Native build platform selection', () => {
  it('accepts explicit iOS and Android platforms', () => {
    expect(resolvePlatform('ios')).toBe('ios')
    expect(resolvePlatform('android')).toBe('android')
  })

  it('rejects invalid or missing platforms before bundling', () => {
    expect(() => resolvePlatform('web')).toThrow('Invalid platform')
    expect(() => resolvePlatform(undefined)).toThrow('Missing required platform')
  })
})
