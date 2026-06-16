export interface CronStatsRefreshState {
  statsUpdatedAt?: string | null
  statsRefreshRequestedAt?: string | null
}

export const CRON_STATS_REFRESH_STALE_MS = 5 * 60 * 1000

function timeValue(value?: string | null) {
  if (!value)
    return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function hasPendingStatsRefresh(state: CronStatsRefreshState, now = new Date()) {
  const requestedAt = timeValue(state.statsRefreshRequestedAt)
  if (!requestedAt)
    return false
  if (now.getTime() - requestedAt >= CRON_STATS_REFRESH_STALE_MS)
    return false
  const updatedAt = timeValue(state.statsUpdatedAt)
  return !updatedAt || requestedAt > updatedAt
}
