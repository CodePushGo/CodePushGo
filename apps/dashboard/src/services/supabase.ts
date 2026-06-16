import { ref } from 'vue'

export const defaultApiHost = 'https://api.codepushgo.com'

export interface CodePushGoConfig {
  apiHost: string
  apiKey: string
  projectId: string
  host: string
  hostWeb: string
  stripeEnabled: boolean
}

export function mergeRemoteConfig(localConfig: CodePushGoConfig, remoteConfig: Partial<CodePushGoConfig>): CodePushGoConfig {
  return {
    ...localConfig,
    host: remoteConfig.host ?? localConfig.host,
    hostWeb: remoteConfig.hostWeb ?? localConfig.hostWeb,
    stripeEnabled: remoteConfig.stripeEnabled ?? localConfig.stripeEnabled,
  }
}

export function getLocalConfig(): CodePushGoConfig {
  return {
    apiHost: defaultApiHost,
    apiKey: '',
    projectId: 'codepushgo',
    host: 'https://console.codepushgo.com',
    hostWeb: 'https://codepushgo.com',
    stripeEnabled: true,
  }
}


export function getSpoofedAdminJwt() {
  return sessionStorage.getItem('capgo_spoofed_admin_jwt')
}

const isoDatePrefixPattern = /^(\d{4})-(\d{2})-(\d{2})/

export const stripeEnabled = ref(true)

function isStrictDateInput(value: string) {
  const match = value.match(isoDatePrefixPattern)
  if (!match)
    return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function fallbackWindow(now: Date) {
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + 1)

  const start = new Date(end)
  start.setDate(start.getDate() - 30)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function parseDashboardDate(value: string | undefined) {
  if (!value || !isStrictDateInput(value))
    return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok)
    throw new Error(`Request failed: ${response.status}`)
  return await response.json() as T
}

export function useSupabase() {
  return {
    auth: {
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        }
      },
      async getSession() {
        return { data: { session: null } }
      },
      async signOut() {
        return { error: null }
      },
    },
    from(table: string) {
      return {
        delete() {
          return {
            async eq(column: string, value: string) {
              const params = new URLSearchParams({ [column]: value })
              const response = await fetch(`/${table.slice(0, -1)}?${params.toString()}`, { method: 'DELETE' })
              return { data: null, error: response.ok ? null : new Error(`Delete failed: ${response.status}`) }
            },
          }
        },
      }
    },
    async rpc<T = unknown>(name: string) {
      if (name === 'get_orgs_v7') {
        const data = await requestJson<T>('/organization')
        return { data, error: null }
      }
      return { data: null as T | null, error: new Error(`Unsupported RPC: ${name}`) }
    },
  }
}

export async function isPlatformAdmin() {
  return false
}

export function normalizeDashboardDateRange(start: string | undefined, end: string | undefined, now = new Date()) {
  const fallback = fallbackWindow(now)
  const startDate = parseDashboardDate(start)
  const endDate = parseDashboardDate(end)

  if (!startDate || !endDate || startDate.getTime() > endDate.getTime())
    return fallback

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  }
}

export interface DashboardBucket {
  bandwidth?: number
  build_time_unit?: number
  date: string
  get?: number
  mau?: number
  storage?: number
}

export interface DashboardResponse {
  byApp: DashboardBucket[]
  global: DashboardBucket[]
}

export async function getAllDashboard(orgId: string, start: string, end: string): Promise<DashboardResponse> {
  const params = new URLSearchParams({ orgId, start, end })
  const response = await fetch(`/dashboard?${params.toString()}`)
  if (!response.ok)
    throw new Error(`Failed to load dashboard: ${response.status}`)
  return await response.json() as DashboardResponse
}

export async function getTotalStorage(orgId: string): Promise<number> {
  const response = await fetch(`/dashboard/storage?orgId=${encodeURIComponent(orgId)}`)
  if (!response.ok)
    throw new Error(`Failed to load storage: ${response.status}`)
  const body = await response.json() as { storage?: number, totalStorage?: number }
  return body.totalStorage ?? body.storage ?? 0
}

export async function findBestPlan(orgId: string): Promise<string | null> {
  const response = await fetch(`/dashboard/plan?orgId=${encodeURIComponent(orgId)}`)
  if (!response.ok)
    throw new Error(`Failed to load plan: ${response.status}`)
  const body = await response.json() as { plan?: string | null }
  return body.plan ?? null
}
