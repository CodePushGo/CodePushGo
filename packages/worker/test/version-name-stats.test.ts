import { describe, expect, it } from 'vitest'
import { buildBundleUsageChart } from '../src/statistics'
import { authHeaders, testApp } from './helpers'

const appId = 'com.version.name.stats'

describe('[Capgo parity] version_name statistics tracking', () => {
  it('groups bundle usage by version_name instead of numeric ids', () => {
    const chart = buildBundleUsageChart([
      { app_id: appId, device_id: 'device-1', platform: 'ios', version_name: '2.5.0-test', action: 'download_complete' },
      { app_id: appId, device_id: 'device-2', platform: 'ios', version_name: '2.5.0-test', action: 'download_complete' },
      { app_id: appId, device_id: 'device-3', platform: 'ios', version_name: '3.0.0-beta', action: 'download_complete' },
      { app_id: appId, device_id: 'device-4', platform: 'ios', version_name: '999', action: 'app_ready' },
    ], appId, '2026-01-01', '2026-01-01')

    expect(chart.labels).toEqual(['2026-01-01'])
    expect(chart.datasets).toEqual([
      { label: '2.5.0-test', data: [2] },
      { label: '3.0.0-beta', data: [1] },
    ])
    expect(JSON.stringify(chart)).not.toContain('version_id')
  })

  it('returns version_name datasets from the bundle_usage endpoint', async () => {
    const { app, env, storage } = testApp()
    await storage.createApp(appId, 'Version Name Stats')
    await storage.recordStats({ app_id: appId, device_id: 'device-1', platform: 'ios', version_name: '2.5.0-test', action: 'download_complete' })
    await storage.recordStats({ app_id: appId, device_id: 'device-2', platform: 'ios', version_name: '2.5.0-test', action: 'download_complete' })
    await storage.recordStats({ app_id: appId, device_id: 'device-3', platform: 'android', version_name: '3.0.0-beta', action: 'download_complete' })

    const response = await app.request(`/statistics/app/${appId}/bundle_usage?from=2026-01-01&to=2026-01-01`, { headers: authHeaders }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      labels: ['2026-01-01'],
      datasets: [
        { label: '2.5.0-test', data: [2] },
        { label: '3.0.0-beta', data: [1] },
      ],
    })
  })
})