import { z } from 'zod'

export const MAX_ADMIN_STATS_LIMIT = 50_000
export const MAX_ADMIN_STATS_OFFSET = 100_000
export const MAX_ANALYTICS_QUERY_LIMIT = 50_000

const isoUtcDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

export const adminStatsMetricCategorySchema = z.enum([
  'uploads',
  'distribution',
  'failures',
  'success_rate',
  'platform_overview',
  'org_metrics',
  'mau_trend',
  'success_rate_trend',
  'apps_trend',
  'bundles_trend',
  'deployments_trend',
  'storage_trend',
  'bandwidth_trend',
  'global_stats_trend',
  'plugin_breakdown',
  'trial_organizations',
  'trial_plan_breakdown',
  'onboarding_funnel',
  'cancelled_users',
  'email_type_breakdown',
  'customer_country_breakdown',
  'organization_insights',
])

export const adminStatsBodySchema = z.object({
  metric_category: adminStatsMetricCategorySchema,
  start_date: z.string().regex(isoUtcDateTimeRegex),
  end_date: z.string().regex(isoUtcDateTimeRegex),
  app_id: z.string().min(1).optional(),
  org_id: z.string().min(1).optional(),
  plan_name: z.string().max(128).optional(),
  billing_type: z.enum(['monthly', 'yearly']).optional(),
  paid_only: z.boolean().optional(),
  search: z.string().max(128).optional(),
  limit: z.number().int().min(1).max(MAX_ADMIN_STATS_LIMIT).optional(),
  offset: z.number().int().min(0).max(MAX_ADMIN_STATS_OFFSET).optional(),
})

export type AdminStatsBody = z.infer<typeof adminStatsBodySchema>

export function normalizeAnalyticsLimit(limit: unknown, fallback = 100): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit))
    return fallback
  const integerLimit = Math.trunc(limit)
  if (integerLimit < 1)
    return fallback
  return Math.min(integerLimit, MAX_ANALYTICS_QUERY_LIMIT)
}

export interface PluginBreakdownRow {
  plugin_version: string
  app_id: string
  device_count: number | string
}

export type PluginVersionBreakdown = Record<string, number>

export interface PluginVersionLadderEntry {
  version: string
  device_count: number
  percent: number
  top_apps: Array<{ app_id: string, device_count: number, share: number }>
}

export interface PluginBreakdownResult {
  version_breakdown: PluginVersionBreakdown
  major_breakdown: PluginVersionBreakdown
  version_ladder: PluginVersionLadderEntry[]
}

export function buildPluginBreakdownResult(result: PluginBreakdownRow[]): PluginBreakdownResult {
  const emptyResult: PluginBreakdownResult = { version_breakdown: {}, major_breakdown: {}, version_ladder: [] }
  if (result.length === 0)
    return emptyResult

  const versionCounts = new Map<string, number>()
  const versionAppCounts = new Map<string, Map<string, number>>()
  for (const row of result) {
    const version = row.plugin_version
    const appId = row.app_id
    const deviceCount = Number(row.device_count) || 0
    if (!(version && appId && deviceCount > 0))
      continue

    versionCounts.set(version, (versionCounts.get(version) || 0) + deviceCount)
    const appCounts = versionAppCounts.get(version) ?? new Map<string, number>()
    appCounts.set(appId, (appCounts.get(appId) || 0) + deviceCount)
    versionAppCounts.set(version, appCounts)
  }

  const total = Array.from(versionCounts.values()).reduce((sum, count) => sum + count, 0)
  if (total === 0)
    return emptyResult

  const version_breakdown: PluginVersionBreakdown = {}
  const majorCounts = new Map<string, number>()
  for (const [version, count] of versionCounts) {
    const percentage = Number(((count / total) * 100).toFixed(2))
    if (percentage > 0)
      version_breakdown[version] = percentage
    const major = version.split('.')[0]
    if (major)
      majorCounts.set(major, (majorCounts.get(major) || 0) + count)
  }

  const major_breakdown: PluginVersionBreakdown = {}
  for (const [major, count] of majorCounts) {
    const percentage = Number(((count / total) * 100).toFixed(2))
    if (percentage > 0)
      major_breakdown[major] = percentage
  }

  const version_ladder = Array.from(versionCounts.entries())
    .sort(([versionA, countA], [versionB, countB]) => countB - countA || versionA.localeCompare(versionB))
    .slice(0, 20)
    .map(([version, count]) => {
      const appCounts = versionAppCounts.get(version) ?? new Map<string, number>()
      const top_apps = Array.from(appCounts.entries())
        .sort(([appA, countA], [appB, countB]) => countB - countA || appA.localeCompare(appB))
        .slice(0, 3)
        .map(([app_id, device_count]) => ({
          app_id,
          device_count,
          share: Number(((device_count / count) * 100).toFixed(2)),
        }))

      return {
        version,
        device_count: count,
        percent: Number(version_breakdown[version]) || 0,
        top_apps,
      }
    })

  return { version_breakdown, major_breakdown, version_ladder }
}
