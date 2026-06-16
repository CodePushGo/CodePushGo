export const CHART_REFRESH_STALE_MS = 5 * 60 * 1000
export const CHART_REFRESH_POLL_MS = 10 * 1000
export const CHART_REFRESH_TIMEOUT_MS = CHART_REFRESH_STALE_MS + CHART_REFRESH_POLL_MS

const timezonePattern = /(Z|[+-]\d{2}:?\d{2})$/i

export function parseDashboardRefreshTimestamp(value: string | null | undefined) {
  if (!value)
    return null
  const source = value.includes('T') && !timezonePattern.test(value) ? `${value}Z` : value
  const parsed = Date.parse(source)
  return Number.isNaN(parsed) ? null : parsed
}

export function isChartRefreshInProgress(requestedAt: string | null | undefined, updatedAt: string | null | undefined, now = Date.now()) {
  const requestedMs = parseDashboardRefreshTimestamp(requestedAt)
  if (requestedMs == null)
    return false
  if (now - requestedMs >= CHART_REFRESH_TIMEOUT_MS)
    return false

  const updatedMs = parseDashboardRefreshTimestamp(updatedAt)
  return updatedMs == null || requestedMs > updatedMs
}

export function isChartDataStale(updatedAt: string | null | undefined, now = Date.now()) {
  const updatedMs = parseDashboardRefreshTimestamp(updatedAt)
  return updatedMs == null || now - updatedMs > CHART_REFRESH_STALE_MS
}

export function shouldAutoRequestChartRefresh(updatedAt: string | null | undefined, requestedAt: string | null | undefined, now = Date.now()) {
  return isChartDataStale(updatedAt, now) && !isChartRefreshInProgress(requestedAt, updatedAt, now)
}

export function isOrgCacheReadyForRefresh(orgUpdatedAt: string | null | undefined, refreshRequestedAt: string | null | undefined) {
  const requestTime = parseDashboardRefreshTimestamp(refreshRequestedAt)
  if (requestTime == null)
    return true
  const orgTime = parseDashboardRefreshTimestamp(orgUpdatedAt)
  return orgTime != null && orgTime >= requestTime
}
