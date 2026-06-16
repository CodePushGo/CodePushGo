import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const userHeaders = {
  authorization: 'Bearer test-token',
  'content-type': 'application/json',
}

const adminHeaders = {
  authorization: 'Bearer admin-token',
  'content-type': 'application/json',
}

const validBody = {
  metric_category: 'global_stats_trend',
  start_date: '2026-04-01T00:00:00.000Z',
  end_date: '2026-04-30T23:59:59.000Z',
}

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token', CODEPUSHGO_ADMIN_API_KEY: 'admin-token' } as Env
  return { app, env }
}

describe('[Capgo parity] /private/admin_stats', () => {
  it('requires platform admin auth before processing body', async () => {
    const { app, env } = testApp()

    const missingAuth = await app.request('https://api.test/private/admin_stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }, env)
    expect(missingAuth.status).toBe(401)
    expect(await missingAuth.json()).toMatchObject({ error: 'no_jwt_apikey_or_subkey' })

    const notAdmin = await app.request('https://api.test/private/admin_stats', {
      method: 'POST',
      headers: userHeaders,
      body: 'invalid json',
    }, env)
    expect(notAdmin.status).toBe(400)
    expect(await notAdmin.json()).toMatchObject({ error: 'not_admin' })
  })

  it('rejects invalid metric bodies for admins', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/private/admin_stats', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ ...validBody, limit: '1 UNION SELECT 1' }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_json_body' })
  })

  it('returns successful global stats and plugin breakdown response shapes', async () => {
    const { app, env } = testApp()
    const globalStats = await app.request('https://api.test/private/admin_stats', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(validBody),
    }, env)
    expect(globalStats.status).toBe(200)
    expect(await globalStats.json()).toEqual({ success: true, data: [] })

    const pluginBreakdown = await app.request('https://api.test/private/admin_stats', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ ...validBody, metric_category: 'plugin_breakdown' }),
    }, env)
    expect(pluginBreakdown.status).toBe(200)
    expect(await pluginBreakdown.json()).toEqual({
      success: true,
      data: { version_breakdown: {}, major_breakdown: {}, version_ladder: [] },
    })
  })

  it('returns Capgo-compatible empty collection shapes for admin organization metrics', async () => {
    const { app, env } = testApp()
    const organizationInsights = await app.request('https://api.test/private/admin_stats', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ ...validBody, metric_category: 'organization_insights', limit: 100, offset: 0 }),
    }, env)
    expect(organizationInsights.status).toBe(200)
    expect(await organizationInsights.json()).toEqual({ success: true, data: { organizations: [], total: 0, plan_options: [] } })

    const onboarding = await app.request('https://api.test/private/admin_stats', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ ...validBody, metric_category: 'onboarding_funnel' }),
    }, env)
    expect(onboarding.status).toBe(200)
    expect(await onboarding.json()).toEqual({
      success: true,
      data: {
        total_orgs: 0,
        orgs_with_app: 0,
        orgs_with_channel: 0,
        orgs_with_bundle: 0,
        orgs_subscribed: 0,
        subscription_conversion_rate: 0,
        trend: [],
      },
    })
  })
})
