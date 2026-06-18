import type { User } from '@supabase/supabase-js'
import { reactive, readonly } from 'vue'
import { findBestPlan, getAllDashboard, getTotalStorage, normalizeDashboardDateRange, type DashboardBucket } from '../services/supabase'

function lastCompleteBucket(buckets: DashboardBucket[]) {
  if (buckets.length === 0)
    return undefined
  return buckets.length > 1 ? buckets[buckets.length - 2] : buckets[0]
}

const state = reactive({
  auth: undefined as User | undefined,
  user: undefined as User | Record<string, unknown> | undefined,
  bestPlan: null as string | null,
  totalDevices: 0,
  totalDownload: 0,
  totalStorage: 0,
})

export function useMainStore() {
  async function updateDashboard(orgId: string, start?: string, end?: string) {
    const range = normalizeDashboardDateRange(start, end)
    const [dashboard, storage, plan] = await Promise.all([
      getAllDashboard(orgId, range.start, range.end),
      getTotalStorage(orgId),
      findBestPlan(orgId),
    ])
    const current = lastCompleteBucket(dashboard.global)
    state.totalDevices = current?.mau ?? 0
    state.totalDownload = current?.get ?? 0
    state.totalStorage = storage
    state.bestPlan = plan
  }

  return {
    state: readonly(state),
    get auth() { return state.auth },
    set auth(value: User | undefined) { state.auth = value },
    get user() { return state.user },
    set user(value: User | Record<string, unknown> | undefined) { state.user = value },
    get bestPlan() { return state.bestPlan },
    get totalDevices() { return state.totalDevices },
    get totalDownload() { return state.totalDownload },
    get totalStorage() { return state.totalStorage },
    updateDashboard,
  }
}
