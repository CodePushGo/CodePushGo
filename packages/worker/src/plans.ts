import type { Context } from 'hono'

export interface PlanUsage {
  total_percent: number
  mau_percent: number
  bandwidth_percent: number
  storage_percent: number
  build_time_percent: number
}

export interface PlanNotificationOrg {
  customer_id: string | null
  name?: string | null
  website?: string | null
  stripe_info?: unknown
}

type PlanUsageMetricKey = Exclude<keyof PlanUsage, 'total_percent'>
type CreditMetric = 'mau' | 'bandwidth' | 'storage' | 'build_time'

export interface PlanNotificationDeps<TClient = unknown> {
  isOnboardedOrg(c: Context, orgId: string): Promise<boolean>
  isOnboardingNeeded(c: Context, orgId: string): Promise<boolean>
  sendNotifToOrgMembers(c: Context, eventName: string, category: string, payload: unknown, orgId: string, recipientUniqId: string, cron: string, client: TClient): Promise<boolean>
  sendNotifToOrgMembersOnce(c: Context, eventName: string, category: string, payload: unknown, orgId: string, recipientUniqId: string, client: TClient): Promise<boolean>
  sendEventToTracking(c: Context, event: unknown): Promise<unknown>
}

const PLAN_USAGE_ALERT_THRESHOLDS = [90, 70, 50] as const
const PLAN_USAGE_ALERT_EVENT_BY_THRESHOLD: Record<(typeof PLAN_USAGE_ALERT_THRESHOLDS)[number], string> = {
  50: 'user:usage_50_percent_of_plan',
  70: 'user:usage_70_percent_of_plan',
  90: 'user:usage_90_percent_of_plan',
}
const PLAN_USAGE_METRICS: Array<{ key: PlanUsageMetricKey, metric: CreditMetric }> = [
  { key: 'mau_percent', metric: 'mau' },
  { key: 'bandwidth_percent', metric: 'bandwidth' },
  { key: 'storage_percent', metric: 'storage' },
  { key: 'build_time_percent', metric: 'build_time' },
]

function getHighestPlanUsage(percentUsage: PlanUsage) {
  return PLAN_USAGE_METRICS.reduce((highest, current) => {
    const percent = Number(percentUsage[current.key] ?? 0)
    return percent > highest.percent ? { metric: current.metric, percent } : highest
  }, { metric: 'mau' as CreditMetric, percent: 0 })
}

function normalizePlanUsage(percentUsage: PlanUsage): PlanUsage {
  const highestUsage = getHighestPlanUsage(percentUsage)
  return { ...percentUsage, total_percent: highestUsage.percent }
}

export function getPlanUsageAlert(percentUsage: PlanUsage) {
  const normalizedUsage = normalizePlanUsage(percentUsage)
  const highestUsage = getHighestPlanUsage(normalizedUsage)
  const threshold = PLAN_USAGE_ALERT_THRESHOLDS.find(value => highestUsage.percent >= value)
  if (!threshold)
    return null

  return {
    eventName: PLAN_USAGE_ALERT_EVENT_BY_THRESHOLD[threshold],
    metric: highestUsage.metric,
    metricPercent: highestUsage.percent,
    percentUsage: normalizedUsage,
    threshold,
  }
}

export async function handleOrgNotificationsAndEvents<TClient>(
  c: Context,
  org: PlanNotificationOrg,
  orgId: string,
  isGoodPlan: boolean,
  percentUsage: PlanUsage,
  client: TClient,
  deps: PlanNotificationDeps<TClient>,
): Promise<boolean> {
  const isOnboarded = await deps.isOnboardedOrg(c, orgId)
  const isOnboardingNeeded = await deps.isOnboardingNeeded(c, orgId)

  if (!isOnboarded && isOnboardingNeeded) {
    const sent = await deps.sendNotifToOrgMembersOnce(c, 'user:need_onboarding', 'onboarding', {
      org_id: orgId,
      org_name: org.name ?? '',
      org_website: org.website ?? null,
    }, orgId, orgId, client)
    if (sent) {
      await deps.sendEventToTracking(c, {
        channel: 'usage',
        event: 'User need onboarding',
        user_id: orgId,
        groups: { organization: orgId },
        notify: false,
      }).catch(() => undefined)
    }
    return isGoodPlan
  }

  if (isGoodPlan && isOnboarded) {
    const alert = getPlanUsageAlert(percentUsage)
    if (!alert)
      return true

    const sent = await deps.sendNotifToOrgMembers(c, alert.eventName, 'usage_limit', {
      metric: alert.metric,
      metric_percent: alert.metricPercent,
      percent: alert.percentUsage,
      threshold: alert.threshold,
    }, orgId, orgId, '0 0 1 * *', client)
    if (sent) {
      await deps.sendEventToTracking(c, {
        channel: 'usage',
        event: `User is at ${alert.threshold}% of plan usage`,
        user_id: orgId,
        groups: { organization: orgId },
        notify: false,
        tags: {
          metric: alert.metric,
          metric_percent: alert.metricPercent.toString(),
          threshold: alert.threshold.toString(),
        },
      }).catch(() => undefined)
    }
    return true
  }

  return isGoodPlan
}
