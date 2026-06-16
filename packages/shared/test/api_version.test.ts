import { describe, expect, it } from 'vitest'
import { CAPGO_API_DEFAULT_VERSION, parseCapgoApiVersion } from '../src/index'

describe('parseCapgoApiVersion', () => {
  it('uses the default version when the header is missing', () => {
    const version = parseCapgoApiVersion(undefined)

    expect(version.isDefault).toBe(true)
    expect(version.raw).toBe(CAPGO_API_DEFAULT_VERSION)
    expect(version.normalized).toBe('2025.10.1')
    expect(version.equals('2025-10-01')).toBe(true)
  })

  it('parses semantic versions from the header', () => {
    const version = parseCapgoApiVersion('v2.1')

    expect(version.isDefault).toBe(false)
    expect(version.major).toBe(2)
    expect(version.minor).toBe(1)
    expect(version.patch).toBe(0)
    expect(version.normalized).toBe('2.1.0')
    expect(version.atLeast('2.0')).toBe(true)
    expect(version.before('3')).toBe(true)
  })

  it('accepts ISO-like date values', () => {
    const version = parseCapgoApiVersion('2024-10-08')

    expect(version.normalized).toBe('2024.10.8')
    expect(version.equals('2024-10-08')).toBe(true)
    expect(version.before('2024-12-01')).toBe(true)
    expect(version.atLeast('2024-01-01')).toBe(true)
  })

  it('routes to handlers based on the requested version', () => {
    const version = parseCapgoApiVersion('2')

    expect(version.handle({
      1: () => 'v1',
      2: () => 'v2',
    })).toBe('v2')
  })

  it('throws when the requested version is unsupported', () => {
    const version = parseCapgoApiVersion('3')

    expect(() => version.handle({ 1: () => 'v1' })).toThrow('unsupported_api_version')
  })

  it('throws when the header is not a valid version', () => {
    expect(() => parseCapgoApiVersion('invalid')).toThrow('unsupported_api_version')
  })
})
