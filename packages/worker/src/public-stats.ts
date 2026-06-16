export interface GlobalStatsSnapshot {
  apps: number
  stars: number
  updates: number
  updates_external?: number | null
}

export interface PublicStatsResponse {
  apps: number
  stars: number
  updates: number
}

export const PUBLIC_STATS_FALLBACK: PublicStatsResponse = {
  apps: 1688,
  stars: 595,
  updates: 1862788600,
}

export function getLatestCompletedGlobalStatsDateId(now = new Date()) {
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(utc - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function publicStatsFromSnapshot(snapshot: GlobalStatsSnapshot | null | undefined): PublicStatsResponse {
  if (!snapshot)
    return { ...PUBLIC_STATS_FALLBACK }
  return {
    apps: snapshot.apps,
    stars: snapshot.stars,
    updates: snapshot.updates + (snapshot.updates_external ?? 0),
  }
}
