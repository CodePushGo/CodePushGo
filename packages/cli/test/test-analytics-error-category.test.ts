import { describe, expect, it } from 'vitest'
import { categorizeCliError, categorizeHttpStatus } from '../src/analytics/error-category'

describe('[Capgo parity] CLI analytics error categories', () => {
  it('maps HTTP status codes to stable analytics categories', () => {
    expect(categorizeHttpStatus(401)).toBe('unauthorized')
    expect(categorizeHttpStatus(403)).toBe('forbidden')
    expect(categorizeHttpStatus(404)).toBe('not_found')
    expect(categorizeHttpStatus(408)).toBe('timeout')
    expect(categorizeHttpStatus(504)).toBe('timeout')
    expect(categorizeHttpStatus(413)).toBe('payload_too_large')
    expect(categorizeHttpStatus(429)).toBe('rate_limited')
    expect(categorizeHttpStatus(400)).toBe('validation_error')
    expect(categorizeHttpStatus(422)).toBe('validation_error')
    expect(categorizeHttpStatus(500)).toBe('server_error')
    expect(categorizeHttpStatus(503)).toBe('server_error')
    expect(categorizeHttpStatus(418)).toBe('unknown')
  })

  it('maps thrown CLI errors without leaking raw messages into analytics dimensions', () => {
    expect(categorizeCliError({ status: 401 })).toBe('unauthorized')
    expect(categorizeCliError(new Error('fetch failed: ECONNREFUSED'))).toBe('network_error')
    expect(categorizeCliError(new Error('The operation timed out'))).toBe('timeout')
    expect(categorizeCliError(new Error('Invalid app id format'))).toBe('validation_error')
    expect(categorizeCliError({ code: 'commander.help' })).toBe('commander')
    expect(categorizeCliError(new Error('something weird'))).toBe('unknown')
    expect(categorizeCliError(undefined)).toBe('unknown')
  })
})
