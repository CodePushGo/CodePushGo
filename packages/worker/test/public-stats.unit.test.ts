import { describe, expect, it } from 'vitest'
import { getLatestCompletedGlobalStatsDateId, PUBLIC_STATS_FALLBACK, publicStatsFromSnapshot } from '../src/public-stats'

describe('[Capgo parity] public stats endpoint', () => {
  it.concurrent('uses the latest completed UTC day for stats lookup', () => {
    expect(getLatestCompletedGlobalStatsDateId(new Date('2026-05-11T00:06:17.122Z'))).toBe('2026-05-10')
  })

  it.concurrent('merges external updates into the public updates counter', () => {
    expect(publicStatsFromSnapshot({ apps: 42, stars: 9, updates: 100, updates_external: 5 })).toEqual({
      apps: 42,
      stars: 9,
      updates: 105,
    })
  })

  it.concurrent('keeps the fallback counters when no completed stats row exists', () => {
    expect(publicStatsFromSnapshot(null)).toEqual(PUBLIC_STATS_FALLBACK)
  })
})
