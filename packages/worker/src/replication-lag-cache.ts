interface ReplicationLagContext {
  get(key: string): unknown
  header(name: string, value: string): void
}

interface ReplicationLagPool {
  query(sql: string): Promise<{ rows?: Array<{ lag_seconds?: string | number | null }> }>
}

const CACHE_TTL_MS = 60 * 1000
const lagCache = new Map<string, { seconds: number, expiresAt: number }>()

export function clearReplicationLagCache() {
  lagCache.clear()
}

export async function setReplicationLagHeader(context: ReplicationLagContext, pool: ReplicationLagPool, now = new Date()) {
  const databaseSource = String(context.get('databaseSource') ?? 'default')
  const cached = lagCache.get(databaseSource)
  const nowMs = now.getTime()
  const seconds = cached && cached.expiresAt > nowMs
    ? cached.seconds
    : await readAndCacheLagSeconds(databaseSource, pool, nowMs)

  context.header('X-Replication-Lag', 'ok')
  context.header('X-Replication-Lag-Seconds', String(seconds))
}

async function readAndCacheLagSeconds(databaseSource: string, pool: ReplicationLagPool, nowMs: number) {
  const result = await pool.query("select extract(epoch from now() - pg_last_xact_replay_timestamp()) as lag_seconds")
  const rawSeconds = result.rows?.[0]?.lag_seconds
  const seconds = normalizeLagSeconds(rawSeconds)
  lagCache.set(databaseSource, { seconds, expiresAt: nowMs + CACHE_TTL_MS })
  return seconds
}

function normalizeLagSeconds(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0')
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}
