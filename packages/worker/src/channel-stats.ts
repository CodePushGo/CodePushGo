export interface DeploymentHistoryEntry {
  version_name: string
  deployed_at: string
}

export type DailyVersionCounts = Record<string, Record<string, number>>

function utcDateLabel(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isHistoricalDate(label: string, today = utcDateLabel(new Date())) {
  return label < today
}

export function generateDateLabels(start: Date, end: Date) {
  const labels: string[] = []
  const cursor = startOfUtcDay(start)
  const last = startOfUtcDay(end)

  if (cursor > last)
    return labels

  while (cursor <= last) {
    labels.push(utcDateLabel(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return labels
}

export function fillMissingDailyCounts(counts: DailyVersionCounts, dates: string[], versions: string[], today = utcDateLabel(new Date())) {
  const filled: DailyVersionCounts = Object.fromEntries(
    dates.map(date => [date, Object.fromEntries(versions.map(version => [version, counts[date]?.[version] ?? 0]))]),
  )

  for (let index = 1; index < dates.length; index += 1) {
    const date = dates[index]
    if (!isHistoricalDate(date, today))
      continue

    const allMissing = versions.every(version => (filled[date]?.[version] ?? 0) === 0)
    if (!allMissing)
      continue

    const previous = filled[dates[index - 1]]
    for (const version of versions)
      filled[date][version] = previous?.[version] ?? 0
  }

  return filled
}

export function getLatestCounts(labels: string[], countsByDate: DailyVersionCounts) {
  if (labels.length === 0)
    return {} as Record<string, number>

  for (let index = labels.length - 1; index >= 0; index -= 1) {
    const label = labels[index]
    const counts = countsByDate[label] ?? {}
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
    if (total > 0)
      return counts
  }

  return countsByDate[labels[labels.length - 1]] ?? {}
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

export function selectRecentChannelVersions(
  deploymentHistory: DeploymentHistoryEntry[],
  currentVersionName: string,
  currentCounts: Record<string, number>,
  limit = 10,
) {
  const uniqueRecentDeployed: string[] = []
  const sortedByRecency = [...deploymentHistory]
    .sort((a, b) => Date.parse(b.deployed_at) - Date.parse(a.deployed_at))
    .map(entry => entry.version_name)

  for (const versionName of sortedByRecency) {
    if (!versionName || uniqueRecentDeployed.includes(versionName))
      continue
    uniqueRecentDeployed.push(versionName)
    if (uniqueRecentDeployed.length >= limit)
      break
  }

  if (currentVersionName && !uniqueRecentDeployed.includes(currentVersionName)) {
    uniqueRecentDeployed.unshift(currentVersionName)
    if (uniqueRecentDeployed.length > limit)
      uniqueRecentDeployed.length = limit
  }

  if (uniqueRecentDeployed.length > 0)
    return uniqueRecentDeployed

  return Object.entries(currentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([versionName]) => versionName)
}

export const channelStatsTestUtils = {
  generateDateLabels,
  fillMissingDailyCounts,
  getLatestCounts,
  convertCountsToPercentagesByName,
  selectRecentChannelVersions,
}
