import { describe, expect, it } from 'vitest'
import { getPaidAtUpdate } from '../src/stripe'

describe('stripe paid_at tracking', () => {
  it.concurrent('sets paid_at when a subscription is first created', () => {
    const eventOccurredAtIso = '2026-03-24T12:00:00.000Z'

    expect(
      getPaidAtUpdate(
        { paid_at: null, status: null },
        'created',
        eventOccurredAtIso,
      ),
    ).toBe(eventOccurredAtIso)
  })

  it.concurrent('sets paid_at when an org becomes paying for the first time', () => {
    const eventOccurredAtIso = '2026-03-24T12:00:00.000Z'

    expect(
      getPaidAtUpdate(
        { paid_at: null, status: null },
        'succeeded',
        eventOccurredAtIso,
      ),
    ).toBe(eventOccurredAtIso)
  })

  it.concurrent('does not overwrite an existing paid_at timestamp', () => {
    expect(
      getPaidAtUpdate(
        { paid_at: '2026-03-20T09:00:00.000Z', status: 'succeeded' },
        'succeeded',
        '2026-03-24T12:00:00.000Z',
      ),
    ).toBeUndefined()
  })

  it.concurrent('does not backfill legacy succeeded rows during unrelated updates', () => {
    expect(
      getPaidAtUpdate(
        { paid_at: null, status: 'succeeded' },
        'succeeded',
        '2026-03-24T12:00:00.000Z',
      ),
    ).toBeUndefined()
  })

  it.concurrent('ignores non-succeeded status changes', () => {
    expect(
      getPaidAtUpdate(
        { paid_at: null, status: null },
        'updated',
        '2026-03-24T12:00:00.000Z',
      ),
    ).toBeUndefined()
  })
})
