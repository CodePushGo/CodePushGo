export interface CronActivitySignals {
  appId: string
  orgId: string
  newestVersionCreatedAt?: string | null
  latestDeviceUsageAt?: string | null
  latestBandwidthUsageAt?: string | null
  latestDailyMauAt?: string | null
}

export interface CronStatAppQueueMessage {
  function_name: 'cron_stat_app'
  function_type: null
  payload: {
    appId: string
    orgId: string
    todayOnly: boolean
  }
}

export interface CronSyncSubQueueMessage {
  function_name: 'cron_sync_sub'
  function_type: null
  payload: {
    orgId: string
    customerId: string
  }
}

export interface CronStatOrgQueueMessage {
  function_name: 'cron_stat_org'
  function_type: 'cloudflare'
  payload: {
    orgId: string
    customerId: string
  }
}

const ACTIVE_USAGE_WINDOW_MS = 24 * 60 * 60 * 1000
const ESTABLISHED_APP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const PLAN_RECALCULATION_WINDOW_MS = 60 * 60 * 1000

export function createCronStatAppQueueMessage(input: { appId: string, orgId: string, todayOnly?: boolean }): CronStatAppQueueMessage {
  return {
    function_name: 'cron_stat_app',
    function_type: null,
    payload: {
      appId: input.appId,
      orgId: input.orgId,
      todayOnly: input.todayOnly ?? false,
    },
  }
}

export function createCronSyncSubQueueMessage(input: { orgId: string, customerId: string }): CronSyncSubQueueMessage {
  return {
    function_name: 'cron_sync_sub',
    function_type: null,
    payload: {
      orgId: input.orgId,
      customerId: input.customerId,
    },
  }
}

export function createCronStatOrgQueueMessage(input: { orgId: string, customerId: string }): CronStatOrgQueueMessage {
  return {
    function_name: 'cron_stat_org',
    function_type: 'cloudflare',
    payload: {
      orgId: input.orgId,
      customerId: input.customerId,
    },
  }
}

export function shouldQueueCronStatApp(signal: CronActivitySignals, now = new Date()): boolean {
  const newestVersionTime = parseTime(signal.newestVersionCreatedAt)
  if (newestVersionTime !== undefined && now.getTime() - newestVersionTime < ESTABLISHED_APP_WINDOW_MS)
    return false

  return [signal.latestDailyMauAt, signal.latestDeviceUsageAt, signal.latestBandwidthUsageAt]
    .some(timestamp => isWithinWindow(timestamp, now, ACTIVE_USAGE_WINDOW_MS))
}

export function shouldQueueCronStatOrg(planCalculatedAt: string | null | undefined, now = new Date()): boolean {
  const calculatedAt = parseTime(planCalculatedAt)
  if (calculatedAt === undefined)
    return true
  return now.getTime() - calculatedAt >= PLAN_RECALCULATION_WINDOW_MS
}

export function buildCronStatAppQueueMessages(signals: CronActivitySignals[], now = new Date()): CronStatAppQueueMessage[] {
  return signals
    .filter(signal => shouldQueueCronStatApp(signal, now))
    .map(signal => createCronStatAppQueueMessage({ appId: signal.appId, orgId: signal.orgId, todayOnly: false }))
}

function isWithinWindow(value: string | null | undefined, now: Date, windowMs: number) {
  const time = parseTime(value)
  return time !== undefined && time <= now.getTime() && now.getTime() - time <= windowMs
}

function parseTime(value: string | null | undefined) {
  if (!value)
    return undefined
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : undefined
}
