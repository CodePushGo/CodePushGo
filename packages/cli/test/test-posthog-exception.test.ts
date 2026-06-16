import { describe, expect, it } from 'vitest'
import { categorizeCliError } from '../src/analytics/error-category'

describe('[Capgo parity] analytics exception classification', () => {
  it('classifies exceptions into stable categories before telemetry', () => {
    expect(categorizeCliError(new Error('fetch failed'))).toBe('network_error')
    expect(categorizeCliError(new Error('request timed out'))).toBe('timeout')
    expect(categorizeCliError(new Error('required token missing'))).toBe('validation_error')
    expect(categorizeCliError({ status: 500 })).toBe('server_error')
  })
})
