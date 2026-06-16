export interface ChartRefreshAppState {
  appId: string
  orgId: string
  statsUpdatedAt?: string | null
  statsRefreshRequestedAt?: string | null
}

export interface ChartRefreshOrgState {
  orgId: string
  statsRefreshRequestedAt?: string | null
}

export interface ChartRefreshResult {
  queuedAppIds: string[]
  queuedCount: number
  skippedCount: number
  requestedAt: string | null
}

const REFRESH_STALE_MS = 5 * 60 * 1000

function timeValue(value?: string | null) {
  if (!value)
    return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function shouldQueueAppStatsRefresh(app: ChartRefreshAppState, now = new Date()) {
  const updatedAt = timeValue(app.statsUpdatedAt)
  const requestedAt = timeValue(app.statsRefreshRequestedAt)
  if (requestedAt && requestedAt >= updatedAt)
    return false
  return !updatedAt || now.getTime() - updatedAt >= REFRESH_STALE_MS
}

export function requestAppChartRefresh(app: ChartRefreshAppState, now = new Date()): ChartRefreshResult & { app: ChartRefreshAppState } {
  if (!shouldQueueAppStatsRefresh(app, now)) {
    return {
      app,
      queuedAppIds: [],
      queuedCount: 0,
      skippedCount: 1,
      requestedAt: app.statsRefreshRequestedAt ?? null,
    }
  }

  const requestedAt = now.toISOString()
  return {
    app: { ...app, statsRefreshRequestedAt: requestedAt },
    queuedAppIds: [app.appId],
    queuedCount: 1,
    skippedCount: 0,
    requestedAt,
  }
}

export function requestOrgChartRefresh(org: ChartRefreshOrgState, apps: ChartRefreshAppState[], now = new Date()) {
  const queuedAppIds: string[] = []
  const refreshedApps = apps.map((app) => {
    if (!shouldQueueAppStatsRefresh(app, now))
      return app
    queuedAppIds.push(app.appId)
    return { ...app, statsRefreshRequestedAt: now.toISOString() }
  })
  const requestedAt = queuedAppIds.length ? now.toISOString() : org.statsRefreshRequestedAt ?? null

  return {
    org: { ...org, statsRefreshRequestedAt: requestedAt },
    apps: refreshedApps,
    queuedAppIds,
    queuedCount: queuedAppIds.length,
    skippedCount: apps.length - queuedAppIds.length,
    requestedAt,
  }
}
