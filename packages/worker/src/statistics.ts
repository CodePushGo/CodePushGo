import type { AppRecord, StatsEvent } from '@codepushgo/shared'

export interface StatisticsBucket {
  app_id?: string
  bandwidth: number
  date: string
  get: number
  mau: number
  storage: number
}

export interface ChartDataset {
  label: string
  data: number[]
}

export interface ChartResponse {
  labels: string[]
  datasets: ChartDataset[]
}

export function hasSeededStats(statsData: unknown) {
  return Array.isArray(statsData) && statsData.some((stat: any) => (stat.mau ?? 0) > 0 || (stat.storage ?? 0) > 0 || (stat.bandwidth ?? 0) > 0 || (stat.get ?? 0) > 0)
}

export function buildStatisticsBuckets(events: StatsEvent[], apps: AppRecord[], date = new Date().toISOString().slice(0, 10)): StatisticsBucket[] {
  const appIds = new Set(apps.map(app => app.appId))
  const buckets = new Map<string, StatisticsBucket>()
  for (const event of events) {
    if (!appIds.has(event.app_id))
      continue
    const bucket = buckets.get(event.app_id) ?? { app_id: event.app_id, date, bandwidth: 0, get: 0, mau: 0, storage: 0 }
    bucket.get += event.action === 'download_complete' ? 1 : 0
    bucket.bandwidth += event.action === 'download_complete' ? 1 : 0
    bucket.mau += event.action === 'app_ready' ? 1 : 0
    buckets.set(event.app_id, bucket)
  }
  return [...buckets.values()]
}

function validDateLabel(value: string | undefined) {
  if (!value)
    return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return undefined
  return date.toISOString().slice(0, 10)
}

function dateLabels(from?: string, to?: string, fallback = new Date().toISOString().slice(0, 10)) {
  const startLabel = validDateLabel(from) ?? fallback
  const endLabel = validDateLabel(to) ?? startLabel
  const labels: string[] = []
  const cursor = new Date(`${startLabel}T00:00:00.000Z`)
  const end = new Date(`${endLabel}T00:00:00.000Z`)
  if (cursor > end)
    return [startLabel]

  while (cursor <= end) {
    labels.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return labels
}

export function buildBundleUsageChart(events: StatsEvent[], appId: string, from?: string, to?: string, fallbackDate?: string): ChartResponse {
  const labels = dateLabels(from, to, fallbackDate)
  const versions = Array.from(new Set(
    events
      .filter(event => event.app_id === appId && event.action === 'download_complete')
      .map(event => event.version_name)
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b))

  return {
    labels,
    datasets: versions.map(versionName => ({
      label: versionName,
      data: labels.map((_label, index) => index === labels.length - 1
        ? events.filter(event => event.app_id === appId && event.action === 'download_complete' && event.version_name === versionName).length
        : 0),
    })),
  }
}

export function emptyChartDataset(): ChartResponse {
  return { labels: [], datasets: [] }
}
