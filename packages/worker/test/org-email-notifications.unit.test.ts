import { describe, expect, it } from 'vitest'
import { getEligibleEmailTargets } from '../src/notifications'

describe('[Capgo parity] org email notification recipient selection', () => {
  it('prefers the management email when it is eligible', () => {
    expect(getEligibleEmailTargets(
      ['admin1@example.com', 'admin2@example.com'],
      'billing@example.com',
    )).toEqual({
      allEmails: ['admin1@example.com', 'admin2@example.com', 'billing@example.com'],
      primaryEmail: 'billing@example.com',
      additionalEmails: ['admin1@example.com', 'admin2@example.com'],
    })
  })

  it('falls back to the first admin when the management email is not eligible', () => {
    expect(getEligibleEmailTargets(
      ['admin1@example.com', 'admin2@example.com'],
      null,
    )).toEqual({
      allEmails: ['admin1@example.com', 'admin2@example.com'],
      primaryEmail: 'admin1@example.com',
      additionalEmails: ['admin2@example.com'],
    })
  })
})
