export type PeriodType = 'seconds' | 'minutes' | 'hours' | 'days'

export interface CronTaskRow {
  id: number
  name: string
  description: string | null
  task_type: string
  target: string | null
  batch_size: number | null
  second_interval: number | null
  minute_interval: number | null
  hour_interval: number | null
  run_at_hour: number | null
  run_at_minute: number | null
  run_at_second: number | null
  run_on_dow: number | null
  run_on_day: number | null
  enabled: boolean
  healthcheck_url: string | null
}

export interface HyperpingHealthcheckPayload {
  name: string
  description?: string
  period_value?: number
  period_type?: PeriodType
  grace_period_value: number
  grace_period_type: PeriodType
  cron?: string
  timezone?: string
}

export interface HealthcheckCandidate {
  grace: string
  row: CronTaskRow
  payload: HyperpingHealthcheckPayload
  schedule: string
}

function requirePositiveNumber(value: number | null | undefined, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 1)
    throw new Error(`${label} must be a positive integer`)
  return value as number
}

function requireInteger(value: number | null | undefined, label: string): number {
  if (!Number.isInteger(value))
    throw new Error(`${label} must be an integer`)
  return value as number
}

function getPeriodParts(seconds: number): { value: number, type: PeriodType } {
  if (seconds >= 24 * 60 * 60 && seconds % (24 * 60 * 60) === 0)
    return { value: seconds / (24 * 60 * 60), type: 'days' }
  if (seconds >= 60 * 60 && seconds % (60 * 60) === 0)
    return { value: seconds / (60 * 60), type: 'hours' }
  if (seconds >= 60 && seconds % 60 === 0)
    return { value: seconds / 60, type: 'minutes' }
  return { value: seconds, type: 'seconds' }
}

function getGracePeriodParts(cadenceSeconds: number, maxGracePeriodSeconds: number) {
  const cappedGraceSeconds = Math.min(maxGracePeriodSeconds, cadenceSeconds - 1)
  return getPeriodParts(Math.max(60, Math.floor(cappedGraceSeconds / 60) * 60))
}

function getScheduledCadenceSeconds(row: CronTaskRow) {
  if (row.second_interval !== null)
    return requirePositiveNumber(row.second_interval, 'second_interval')
  if (row.minute_interval !== null)
    return requirePositiveNumber(row.minute_interval, 'minute_interval') * 60
  if (row.hour_interval !== null)
    return requirePositiveNumber(row.hour_interval, 'hour_interval') * 60 * 60
  if (row.run_at_minute !== null && row.run_at_hour === null)
    return 60 * 60
  if (row.run_on_day !== null)
    return 28 * 24 * 60 * 60
  if (row.run_on_dow !== null)
    return 7 * 24 * 60 * 60
  if (row.run_at_hour !== null)
    return 24 * 60 * 60
  throw new Error('No supported cron schedule fields found')
}

function formatPeriod(value: number, type: PeriodType) {
  return `${value} ${type}`
}

function getHealthcheckName(row: CronTaskRow) {
  return `CodePushGo cron: ${row.name}`
}

function getHealthcheckDescription(row: CronTaskRow) {
  const description = row.description?.trim()
  return description || undefined
}

function getCronExpression(row: CronTaskRow) {
  const minute = row.run_at_minute ?? 0
  const hour = requireInteger(row.run_at_hour, 'run_at_hour')
  const dayOfMonth = row.run_on_day ?? '*'
  const dayOfWeek = row.run_on_dow ?? '*'
  if (hour < 0 || hour > 23)
    throw new Error(`run_at_hour must be between 0 and 23, got ${hour}`)
  if (minute < 0 || minute > 59)
    throw new Error(`run_at_minute must be between 0 and 59, got ${minute}`)
  return `${minute} ${hour} ${dayOfMonth} * ${dayOfWeek}`
}

function getHourlyCronExpression(row: CronTaskRow) {
  const minute = requireInteger(row.run_at_minute, 'run_at_minute')
  if (minute < 0 || minute > 59)
    throw new Error(`run_at_minute must be between 0 and 59, got ${minute}`)
  return `${minute} * * * *`
}

export function buildHealthcheckPayload(row: CronTaskRow, maxGracePeriodSeconds: number, timezone: string): HealthcheckCandidate {
  const cadenceSeconds = getScheduledCadenceSeconds(row)
  const gracePeriod = getGracePeriodParts(cadenceSeconds, maxGracePeriodSeconds)
  const payload: HyperpingHealthcheckPayload = {
    name: getHealthcheckName(row),
    description: getHealthcheckDescription(row),
    grace_period_value: gracePeriod.value,
    grace_period_type: gracePeriod.type,
  }
  const grace = formatPeriod(gracePeriod.value, gracePeriod.type)

  if (row.second_interval !== null) {
    const periodValue = requirePositiveNumber(row.second_interval, 'second_interval')
    return { grace, row, payload: { ...payload, period_value: periodValue, period_type: 'seconds' }, schedule: `every ${periodValue} seconds` }
  }
  if (row.minute_interval !== null) {
    const periodValue = requirePositiveNumber(row.minute_interval, 'minute_interval')
    return { grace, row, payload: { ...payload, period_value: periodValue, period_type: 'minutes' }, schedule: `every ${periodValue} minutes` }
  }
  if (row.hour_interval !== null) {
    const periodValue = requirePositiveNumber(row.hour_interval, 'hour_interval')
    return { grace, row, payload: { ...payload, period_value: periodValue, period_type: 'hours' }, schedule: `every ${periodValue} hours` }
  }
  if (row.run_at_hour !== null) {
    const cron = getCronExpression(row)
    return { grace, row, payload: { ...payload, cron, timezone }, schedule: `${cron} ${timezone}` }
  }
  if (row.run_at_minute !== null) {
    const cron = getHourlyCronExpression(row)
    return { grace, row, payload: { ...payload, cron, timezone }, schedule: `${cron} ${timezone}` }
  }
  throw new Error('No supported cron schedule fields found')
}
