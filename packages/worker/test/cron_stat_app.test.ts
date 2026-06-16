import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

const jsonHeaders = { 'content-type': 'application/json' }

describe('[Capgo parity] cron_stat_app', () => {
  it('marks app stats refreshed and completes org refresh when no app remains pending', async () => {
    const { app, env, storage } = testApp()
    const orgId = 'org-cron-stat-app'
    const appId = 'com.test.cron.app'

    await storage.upsertOrganization({ id: orgId, name: 'Cron App Org' })
    await storage.createApp(appId, appId, orgId)

    const response = await app.request('/triggers/cron_stat_app', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ appId, orgId }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'Stats saved' })

    const refreshedApp = await storage.getApp(appId)
    const refreshedOrg = await storage.getOrganization(orgId)
    expect(Date.parse(refreshedApp?.statsUpdatedAt ?? '')).toBeGreaterThan(0)
    expect(Date.parse(refreshedOrg?.statsUpdatedAt ?? '')).toBeGreaterThan(0)
  })
})
