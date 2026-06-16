import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindBestPlan = vi.fn()
const mockGetAllDashboard = vi.fn()
const mockGetTotalStorage = vi.fn()
const mockNormalizeDashboardDateRange = vi.fn()

vi.mock('../services/supabase', () => ({
  findBestPlan: mockFindBestPlan,
  getAllDashboard: mockGetAllDashboard,
  getTotalStorage: mockGetTotalStorage,
  normalizeDashboardDateRange: mockNormalizeDashboardDateRange,
}))

function createGlobalDashboard() {
  return Array.from({ length: 30 }, (_, index) => ({
    bandwidth: index,
    build_time_unit: index,
    date: `2026-04-${String(index + 1).padStart(2, '0')}`,
    get: index,
    mau: index,
    storage: index,
  }))
}

describe('[Capgo parity] main store dashboard range normalization', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    const global = createGlobalDashboard()
    global[28] = {
      ...global[28],
      get: 2220,
      mau: 111,
    }
    global[29] = {
      ...global[29],
      get: 9990,
      mau: 999,
    }

    mockNormalizeDashboardDateRange.mockReturnValue({
      end: '2026-04-22T00:00:00.000Z',
      start: '2026-03-23T00:00:00.000Z',
    })
    mockGetAllDashboard.mockResolvedValue({
      byApp: [],
      global,
    })
    mockGetTotalStorage.mockResolvedValue(321)
    mockFindBestPlan.mockResolvedValue('team')
  })

  it('uses the normalized range when selecting the current dashboard bucket', async () => {
    const { useMainStore } = await import('./main')
    const store = useMainStore()

    await store.updateDashboard('org-123')

    expect(mockNormalizeDashboardDateRange).toHaveBeenCalledWith(undefined, undefined)
    expect(mockGetAllDashboard).toHaveBeenCalledWith(
      'org-123',
      '2026-03-23T00:00:00.000Z',
      '2026-04-22T00:00:00.000Z',
    )
    expect(store.totalDevices).toBe(111)
    expect(store.totalDownload).toBe(2220)
    expect(store.totalStorage).toBe(321)
    expect(store.bestPlan).toBe('team')
  })
})
