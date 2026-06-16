import type { PluginVersionLadderEntry } from '../packages/worker/src/admin-stats'
import { buildPluginBreakdownResult } from '../packages/worker/src/admin-stats'

export { buildPluginBreakdownResult }

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

function parseJsonString(value: string) {
  try {
    return JSON.parse(value) as unknown
  }
  catch {
    return null
  }
}

export function parseBreakdown(value: Json | null): Record<string, number> {
  if (!value)
    return {}

  const rawValue = typeof value === 'string' ? parseJsonString(value) : value
  if (!(rawValue && typeof rawValue === 'object') || Array.isArray(rawValue))
    return {}

  return Object.entries(rawValue as Record<string, unknown>).reduce<Record<string, number>>((acc, [version, percent]) => {
    const normalizedPercent = Number(percent) || 0
    if (version && normalizedPercent > 0)
      acc[version] = normalizedPercent
    return acc
  }, {})
}

export function parseLadder(value: Json | null): PluginVersionLadderEntry[] {
  if (!value)
    return []

  const rawValue = typeof value === 'string' ? parseJsonString(value) : value
  if (!Array.isArray(rawValue))
    return []

  return rawValue
    .map((item) => {
      if (!(item && typeof item === 'object'))
        return null

      const entry = item as Record<string, unknown>
      const version = typeof entry.version === 'string' ? entry.version : ''
      const deviceCount = Number(entry.device_count) || 0
      const percent = Number(entry.percent) || 0
      const topApps = Array.isArray(entry.top_apps)
        ? entry.top_apps
            .map((app) => {
              if (!(app && typeof app === 'object'))
                return null

              const appEntry = app as Record<string, unknown>
              const appId = typeof appEntry.app_id === 'string' ? appEntry.app_id : ''
              const appDeviceCount = Number(appEntry.device_count) || 0
              const share = Number(appEntry.share) || 0

              return {
                app_id: appId,
                device_count: appDeviceCount,
                share,
              }
            })
            .filter((app): app is PluginVersionLadderEntry['top_apps'][number] => !!app && app.app_id.length > 0 && app.device_count > 0)
        : []

      return {
        version,
        device_count: deviceCount,
        percent,
        top_apps: topApps,
      }
    })
    .filter((entry): entry is PluginVersionLadderEntry => !!entry && entry.version.length > 0 && entry.device_count > 0)
}

export function applyStoredPercents(ladder: PluginVersionLadderEntry[], storedBreakdown: Record<string, number>) {
  return ladder.map(entry => ({
    ...entry,
    percent: Number(storedBreakdown[entry.version]) || entry.percent,
  }))
}
