export interface BundleUsageDataset {
  label: string
  data: number[]
}

export interface DailyBundleUsageRow {
  date: string
  app_id: string
  version_name: string
  get: number
  install: number
  uninstall: number
}

export type DailyVersionCounts = Record<string, Record<string, number>>

function utcDateLabel(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function generateDateLabels(start: Date, end: Date) {
  const labels: string[] = []
  const cursor = startOfUtcDay(start)
  const last = startOfUtcDay(end)

  while (cursor <= last) {
    labels.push(utcDateLabel(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return labels
}

function isHistoricalDate(label: string, today = utcDateLabel(new Date())) {
  return label < today
}

export function fillMissingDailyData(datasets: BundleUsageDataset[], labels: string[], today?: string) {
  const filled = datasets.map(dataset => ({ ...dataset, data: [...dataset.data] }))

  for (let index = 1; index < labels.length; index += 1) {
    if (!isHistoricalDate(labels[index], today))
      continue
    const allMissing = filled.every(dataset => (dataset.data[index] ?? 0) === 0)
    if (!allMissing)
      continue
    for (const dataset of filled)
      dataset.data[index] = dataset.data[index - 1] ?? 0
  }

  return filled
}

export function buildDailyReportedCountsByName(usage: DailyBundleUsageRow[], dates: string[], versions: string[]) {
  const counts: DailyVersionCounts = Object.fromEntries(
    dates.map(date => [date, Object.fromEntries(versions.map(version => [version, 0]))]),
  )

  for (const row of usage) {
    if (!counts[row.date] || !versions.includes(row.version_name))
      continue
    counts[row.date][row.version_name] += Number(row.get) || 0
  }

  return counts
}

export function fillMissingDailyCounts(counts: DailyVersionCounts, dates: string[], versions: string[], today = utcDateLabel(new Date())) {
  const filled: DailyVersionCounts = Object.fromEntries(
    dates.map(date => [date, Object.fromEntries(versions.map(version => [version, counts[date]?.[version] ?? 0]))]),
  )

  for (let index = 1; index < dates.length; index += 1) {
    const date = dates[index]
    if (!isHistoricalDate(date, today))
      continue
    const allMissing = versions.every(version => (filled[date][version] ?? 0) === 0)
    if (!allMissing)
      continue
    const previous = filled[dates[index - 1]]
    for (const version of versions)
      filled[date][version] = previous?.[version] ?? 0
  }

  return filled
}

export function convertCountsToPercentagesByName(counts: DailyVersionCounts, dates: string[], versions: string[]) {
  const percentages: DailyVersionCounts = {}

  for (const date of dates) {
    const total = versions.reduce((sum, version) => sum + (counts[date]?.[version] ?? 0), 0)
    percentages[date] = Object.fromEntries(versions.map((version) => {
      const value = total > 0 ? ((counts[date]?.[version] ?? 0) / total) * 100 : 0
      return [version, value]
    }))
  }

  return percentages
}

export function getLatestDayVersionShare(versions: string[], dates: string[], counts: DailyVersionCounts) {
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const date = dates[index]
    const total = versions.reduce((sum, version) => sum + (counts[date]?.[version] ?? 0), 0)
    if (total <= 0)
      continue

    const name = versions.reduce((top, version) => {
      return (counts[date]?.[version] ?? 0) > (counts[date]?.[top] ?? 0) ? version : top
    }, versions[0])

    return {
      name,
      percentage: ((counts[date]?.[name] ?? 0) / total) * 100,
    }
  }

  return { name: versions[0] ?? '', percentage: 0 }
}

export const bundleUsageTestUtils = {
  generateDateLabels,
  fillMissingDailyData,
  buildDailyReportedCountsByName,
  fillMissingDailyCounts,
  convertCountsToPercentagesByName,
  getLatestDayVersionShare,
}
