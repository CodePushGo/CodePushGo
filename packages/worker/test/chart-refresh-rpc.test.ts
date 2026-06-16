import { describe, expect, it } from 'vitest'
import { requestAppChartRefresh, requestOrgChartRefresh, shouldQueueAppStatsRefresh } from '../src/chart-refresh'

describe('chart refresh RPCs', () => {
  const now = new Date('2026-06-15T10:00:00.000Z')
  const staleUpdatedAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
  const freshUpdatedAt = now.toISOString()

  it('queue_cron_stat_app_for_app only stamps refresh_requested_at when it enqueues work', () => {
    expect(shouldQueueAppStatsRefresh({ appId: 'com.chart.stale', orgId: 'org-1', statsUpdatedAt: staleUpdatedAt }, now)).toBe(true)
    expect(shouldQueueAppStatsRefresh({ appId: 'com.chart.fresh', orgId: 'org-1', statsUpdatedAt: freshUpdatedAt }, now)).toBe(false)
  })

  it('request_app_chart_refresh queues once when stale', () => {
    const firstResponse = requestAppChartRefresh({ appId: 'com.chart.stale', orgId: 'org-1', statsUpdatedAt: staleUpdatedAt }, now)

    expect(firstResponse.queuedAppIds).toEqual(['com.chart.stale'])
    expect(firstResponse.queuedCount).toBe(1)
    expect(firstResponse.skippedCount).toBe(0)
    expect(firstResponse.app.statsRefreshRequestedAt).toBe(now.toISOString())

    const secondResponse = requestAppChartRefresh(firstResponse.app, now)
    expect(secondResponse.queuedCount).toBe(0)
    expect(secondResponse.skippedCount).toBe(1)
  })

  it('request_org_chart_refresh stamps org refresh state and only queues stale apps', () => {
    const response = requestOrgChartRefresh({ orgId: 'org-1' }, [
      { appId: 'com.chart.stale', orgId: 'org-1', statsUpdatedAt: staleUpdatedAt },
      { appId: 'com.chart.fresh', orgId: 'org-1', statsUpdatedAt: freshUpdatedAt },
    ], now)

    expect(response.queuedAppIds).toEqual(['com.chart.stale'])
    expect(response.queuedCount).toBe(1)
    expect(response.skippedCount).toBe(1)
    expect(response.requestedAt).toBe(now.toISOString())
    expect(response.org.statsRefreshRequestedAt).toBe(now.toISOString())
    expect(response.apps.find(app => app.appId === 'com.chart.stale')?.statsRefreshRequestedAt).toBe(now.toISOString())
    expect(response.apps.find(app => app.appId === 'com.chart.fresh')?.statsRefreshRequestedAt).toBeUndefined()
  })

  it('request_org_chart_refresh preserves the current org request marker when no apps are queued', () => {
    const inProgressRequestedAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    const response = requestOrgChartRefresh({ orgId: 'org-1', statsRefreshRequestedAt: inProgressRequestedAt }, [
      { appId: 'com.chart.stale', orgId: 'org-1', statsUpdatedAt: freshUpdatedAt, statsRefreshRequestedAt: inProgressRequestedAt },
      { appId: 'com.chart.fresh', orgId: 'org-1', statsUpdatedAt: freshUpdatedAt, statsRefreshRequestedAt: inProgressRequestedAt },
    ], now)

    expect(response.queuedAppIds).toEqual([])
    expect(response.queuedCount).toBe(0)
    expect(response.skippedCount).toBe(2)
    expect(response.requestedAt).toBe(inProgressRequestedAt)
    expect(response.org.statsRefreshRequestedAt).toBe(inProgressRequestedAt)
  })
})
