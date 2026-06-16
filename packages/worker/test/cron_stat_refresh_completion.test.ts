import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

const jsonHeaders = { 'content-type': 'application/json' }

describe('[Capgo parity] cron_stat_app refresh completion', () => {
  it('refreshes the org only after every pending app refresh has completed', async () => {
    const { app, env, storage } = testApp()
    const orgId = 'org-cron-refresh-completion'
    const firstAppId = 'com.test.cron.first'
    const secondAppId = 'com.test.cron.second'
    const requestedAt = new Date(Date.now() - 60_000).toISOString()

    await storage.upsertOrganization({ id: orgId, name: 'Refresh Completion Org' })
    await storage.createApp(firstAppId, firstAppId, orgId)
    await storage.createApp(secondAppId, secondAppId, orgId)

    const org = storage.organizations.get(orgId)!
    storage.organizations.set(orgId, { ...org, statsRefreshRequestedAt: requestedAt, statsUpdatedAt: null, lastStatsUpdatedAt: null })
    for (const appId of [firstAppId, secondAppId]) {
      const record = storage.apps.get(appId)!
      storage.apps.set(appId, { ...record, statsRefreshRequestedAt: requestedAt, statsUpdatedAt: null })
    }

    const firstResponse = await app.request('/triggers/cron_stat_app', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ appId: firstAppId, orgId }),
    }, env)
    expect(firstResponse.status).toBe(200)
    expect((await storage.getApp(firstAppId))?.statsUpdatedAt).toBeTruthy()
    expect((await storage.getOrganization(orgId))?.statsUpdatedAt).toBeNull()

    const secondResponse = await app.request('/triggers/cron_stat_app', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ appId: secondAppId, orgId }),
    }, env)
    expect(secondResponse.status).toBe(200)
    expect((await storage.getApp(secondAppId))?.statsUpdatedAt).toBeTruthy()
    expect(Date.parse((await storage.getOrganization(orgId))?.statsUpdatedAt ?? '')).toBeGreaterThan(0)
  })
})
