export interface StorageSizeEvent {
  version_id: number | string
  size: number
  timestamp: string
}

export interface CalculateStorageHourlyRowsOptions {
  appId: string
  ownerOrg: string
  cycleStart: string
  cycleEnd: string
  currentHour: string
}

export interface StorageHourlyRow {
  app_id: string
  owner_org: string
  date: string
  storage_byte_hours: number
}

const hourMs = 60 * 60 * 1000

export function calculateStorageHourlyRows(events: StorageSizeEvent[], options: CalculateStorageHourlyRowsOptions) {
  const cycleStart = Date.parse(options.cycleStart)
  const cycleEnd = Date.parse(options.cycleEnd)
  const currentHour = Date.parse(options.currentHour)
  const end = Math.min(cycleEnd, currentHour)
  if (!Number.isFinite(cycleStart) || !Number.isFinite(cycleEnd) || !Number.isFinite(currentHour) || end <= cycleStart)
    return { rows: [] as StorageHourlyRow[] }

  const sorted = events
    .map(event => ({ ...event, at: Date.parse(event.timestamp) }))
    .filter(event => Number.isFinite(event.at))
    .sort((a, b) => a.at - b.at)

  let activeBytes = 0
  let cursor = cycleStart
  const byDate = new Map<string, number>()

  for (const event of sorted) {
    if (event.at <= cycleStart) {
      activeBytes += event.size
      continue
    }
    if (event.at >= end)
      break
    addByteHours(byDate, cursor, event.at, activeBytes)
    activeBytes += event.size
    cursor = event.at
  }

  addByteHours(byDate, cursor, end, activeBytes)

  return {
    rows: Array.from(byDate.entries())
      .filter(([, storageByteHours]) => storageByteHours !== 0)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, storageByteHours]) => ({
        app_id: options.appId,
        owner_org: options.ownerOrg,
        date,
        storage_byte_hours: storageByteHours,
      })),
  }
}

function addByteHours(byDate: Map<string, number>, start: number, end: number, activeBytes: number) {
  if (activeBytes === 0 || end <= start)
    return

  let cursor = start
  while (cursor < end) {
    const date = new Date(cursor).toISOString().slice(0, 10)
    const nextDay = Date.parse(`${date}T00:00:00.000Z`) + 24 * hourMs
    const segmentEnd = Math.min(end, nextDay)
    const byteHours = activeBytes * ((segmentEnd - cursor) / hourMs)
    byDate.set(date, roundStorageByteHours((byDate.get(date) ?? 0) + byteHours))
    cursor = segmentEnd
  }
}

function roundStorageByteHours(value: number) {
  return Number(value.toFixed(6))
}
