import { describe, expect, it } from 'vitest'
import { hasPendingStatsRefresh } from '../src/cron-stats'

describe('[Capgo parity] cron_stat_app follow-up refresh detection', () => {
  it('treats a fresh request without a newer stats update as pending', () => {
    const now = new Date('2026-06-16T10:00:00.000Z')
    expect(hasPendingStatsRefresh({ statsRefreshRequestedAt: '2026-06-16T09:59:00.000Z', statsUpdatedAt: null }, now)).toBe(true)
    expect(hasPendingStatsRefresh({ statsRefreshRequestedAt: '2026-06-16T09:59:00.000Z', statsUpdatedAt: '2026-06-16T09:58:00.000Z' }, now)).toBe(true)
  })

  it('ignores completed and stale refresh requests', () => {
    const now = new Date('2026-06-16T10:00:00.000Z')
    expect(hasPendingStatsRefresh({ statsRefreshRequestedAt: '2026-06-16T09:59:00.000Z', statsUpdatedAt: '2026-06-16T10:00:00.000Z' }, now)).toBe(false)
    expect(hasPendingStatsRefresh({ statsRefreshRequestedAt: '2026-06-16T09:54:59.000Z', statsUpdatedAt: null }, now)).toBe(false)
    expect(hasPendingStatsRefresh({ statsRefreshRequestedAt: null, statsUpdatedAt: null }, now)).toBe(false)
  })
})
