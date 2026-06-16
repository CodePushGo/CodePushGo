import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function hasSeededStats(statsData: unknown) {
  return Array.isArray(statsData) && statsData.some((stat: any) => (stat.mau ?? 0) > 0 || (stat.storage ?? 0) > 0 || (stat.bandwidth ?? 0) > 0 || (stat.get ?? 0) > 0)
}

async function seedStatsApp() {
  const { app, env, storage } = testApp()
  const orgId = 'org-stats'
  const appId = 'com.stats.app'
  await storage.upsertOrganization({ id: orgId, name: 'Stats Org' })
  await storage.createApp(appId, appId, orgId)
  await storage.recordStats({
    app_id: appId,
    device_id: 'device-1',
    platform: 'ios',
    version_name: '1.0.0',
    action: 'app_ready',
  })
  await storage.recordStats({
    app_id: appId,
    device_id: 'device-1',
    platform: 'ios',
    version_name: '1.0.0',
    action: 'download_complete',
  })
  return { app, env, storage, orgId, appId }
}

describe('[Capgo parity] [GET] /statistics operations with and without subkey', () => {
  it('gets app statistics for an accessible app', async () => {
    const { app, env, appId } = await seedStatsApp()

    const response = await app.request(`/statistics/app/${appId}?from=2026-01-01&to=2026-01-02`, { headers: authHeaders }, env)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(hasSeededStats(body)).toBe(true)
  })

  it('gets organization statistics and breakdown for an accessible org', async () => {
    const { app, env, orgId, appId } = await seedStatsApp()

    const response = await app.request(`/statistics/org/${orgId}?from=2026-01-01&to=2026-01-02&breakdown=true&noAccumulate=true`, { headers: authHeaders }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as { global: any[], byApp: any[] }
    expect(Array.isArray(body.global)).toBe(true)
    expect(Array.isArray(body.byApp)).toBe(true)
    expect(hasSeededStats(body.global)).toBe(true)
    expect(body.byApp.some(stat => stat.app_id === appId)).toBe(true)
  })

  it('gets user statistics and chart-shaped usage endpoints', async () => {
    const { app, env, appId } = await seedStatsApp()

    const userStats = await app.request('/statistics/user?from=2026-01-01&to=2026-01-02', { headers: authHeaders }, env)
    expect(userStats.status).toBe(200)
    expect(Array.isArray(await userStats.json())).toBe(true)

    const bundleUsage = await app.request(`/statistics/app/${appId}/bundle_usage?from=2026-01-01&to=2026-01-02`, { headers: authHeaders }, env)
    expect(bundleUsage.status).toBe(200)
    expect(await bundleUsage.json()).toMatchObject({ labels: ['2026-01-01', '2026-01-02'], datasets: [{ label: '1.0.0', data: [0, 1] }] })

    const nativeUsage = await app.request(`/statistics/app/${appId}/native_usage?from=2026-01-01&to=2026-01-02`, { headers: authHeaders }, env)
    expect(nativeUsage.status).toBe(200)
    expect(await nativeUsage.json()).toMatchObject({ labels: [], datasets: [] })
  })

  it('does not reveal inaccessible app existence', async () => {
    const { app, env } = testApp()

    const response = await app.request('/statistics/app/com.unknown.app?from=2026-01-01&to=2026-01-02', { headers: authHeaders }, env)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'no_access_to_app' })
  })
})
