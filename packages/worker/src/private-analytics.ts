import type { StatsEventRecord } from './storage'
import { allowedStatsActions } from './stats-actions'

export interface PrivateAnalyticsQuery {
  appId: string
  actions?: string[]
  devicesId?: string[]
  limit?: number
  search?: string
  start_date?: string
  end_date?: string
  format?: 'json' | 'csv'
}

export interface PrivateAnalyticsExportResult {
  status: 'ok'
  format: 'json' | 'csv'
  filename: string
  contentType: string
  rowCount: number
  limit: number
  data?: StatsEventRecord[]
  csv?: string
}

const allowedActions = allowedStatsActions
const safeIdentifier = /^[A-Za-z0-9._:-]{1,128}$/
const csvHeaders = ['created_at', 'app_id', 'device_id', 'action', 'version_name', 'metadata'] as const

export class PrivateAnalyticsValidationError extends Error {
  constructor(message = 'Invalid body') {
    super(message)
    this.name = 'PrivateAnalyticsValidationError'
  }
}

export function parsePrivateAnalyticsQuery(input: unknown): PrivateAnalyticsQuery {
  if (!isRecord(input))
    throw new PrivateAnalyticsValidationError()

  const appId = readRequiredString(input, 'appId')
  const query: PrivateAnalyticsQuery = { appId }

  if (input.devicesId !== undefined)
    query.devicesId = readSafeStringArray(input.devicesId)
  if (input.actions !== undefined)
    query.actions = readActions(input.actions)
  if (input.limit !== undefined)
    query.limit = readLimit(input.limit)
  if (input.search !== undefined)
    query.search = readSearch(input.search)
  if (input.rangeStart !== undefined)
    query.start_date = readDate(input.rangeStart)
  if (input.rangeEnd !== undefined)
    query.end_date = readDate(input.rangeEnd)
  if (input.format !== undefined)
    query.format = readFormat(input.format)

  return query
}

export function buildPrivateAnalyticsExport(query: PrivateAnalyticsQuery, events: StatsEventRecord[], now = new Date()): PrivateAnalyticsExportResult {
  const format = query.format ?? 'json'
  const limit = query.limit ?? 100
  const filename = `codepushgo-logs-${query.appId}-${now.toISOString().slice(0, 10)}.${format}`
  if (format === 'csv') {
    return {
      status: 'ok',
      format,
      filename,
      contentType: 'text/csv; charset=utf-8',
      rowCount: events.length,
      limit,
      csv: buildStatsCsv(events),
    }
  }

  return {
    status: 'ok',
    format,
    filename,
    contentType: 'application/json; charset=utf-8',
    rowCount: events.length,
    limit,
    data: events,
  }
}

function buildStatsCsv(events: StatsEventRecord[]) {
  const rows = events.map(event => [
    event.created_at,
    event.app_id,
    event.device_id,
    event.action,
    event.version_name,
    event.metadata ? JSON.stringify(event.metadata) : '',
  ].map(csvCell).join(','))
  return `${csvHeaders.join(',')}\n${rows.length ? `${rows.join('\n')}\n` : ''}`
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRequiredString(input: Record<string, unknown>, key: string) {
  const value = input[key]
  if (typeof value !== 'string' || value.length === 0)
    throw new PrivateAnalyticsValidationError()
  return value
}

function readSafeStringArray(value: unknown) {
  if (!Array.isArray(value))
    throw new PrivateAnalyticsValidationError()
  return value.map((item) => {
    if (typeof item !== 'string' || !safeIdentifier.test(item))
      throw new PrivateAnalyticsValidationError()
    return item
  })
}

function readActions(value: unknown) {
  const actions = readSafeStringArray(value)
  if (!actions.every(action => allowedActions.has(action)))
    throw new PrivateAnalyticsValidationError()
  return actions
}

function readLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1000)
    throw new PrivateAnalyticsValidationError()
  return value
}

function readSearch(value: unknown) {
  if (typeof value !== 'string' || hasControlCharacter(value))
    throw new PrivateAnalyticsValidationError()
  return value
}

function hasControlCharacter(value: string) {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127
  })
}

function readDate(value: unknown) {
  let timestamp: number
  if (typeof value === 'number') {
    timestamp = value
  }
  else if (typeof value === 'string' && /^\d+$/.test(value)) {
    timestamp = Number(value)
  }
  else if (typeof value === 'string') {
    timestamp = Date.parse(value)
  }
  else {
    throw new PrivateAnalyticsValidationError()
  }

  if (!Number.isFinite(timestamp))
    throw new PrivateAnalyticsValidationError()
  return new Date(timestamp).toISOString()
}

function readFormat(value: unknown) {
  if (value !== 'json' && value !== 'csv')
    throw new PrivateAnalyticsValidationError()
  return value
}
