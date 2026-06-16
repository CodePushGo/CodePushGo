export interface StatisticsResult<T = unknown> {
  data: T | null
  error: { message?: string, error?: string } | null
  status: number
}

export async function executeStatsQueryWithRetry<T>(query: () => Promise<StatisticsResult<T>>) {
  const first = await query()
  if (!isRetryableStatsResult(first))
    return first
  return await query()
}

export function isRetryableStatsResult(result: StatisticsResult) {
  if (result.status >= 500 && result.status < 600)
    return true
  const message = result.error?.message ?? result.error?.error ?? ''
  return /\b(502|503|504)\b/.test(message) || message.toLowerCase().includes('timeout')
}

export function resolveAppOwnerOrgFromRows(rows: Array<{ owner_org?: string | null }> | null | undefined) {
  const row = rows?.[0]
  return row?.owner_org ? { ownerOrg: row.owner_org, error: null, notFound: false } : { ownerOrg: null, error: null, notFound: true }
}

export function getMissingAppStatsError(results: Array<{ error?: string, status?: number }>) {
  return results.find(result => result.error === 'app_not_found' && result.status === 404)
}
