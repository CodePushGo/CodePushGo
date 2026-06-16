import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] error cases', () => {
  it('returns statistics access errors', async () => {
    const { app, env } = testApp()

    const appStats = await app.request('https://api.test/statistics/app/nonexistent.app.id?from=2&to=1', { headers: authHeaders }, env)
    expect(appStats.status).toBe(401)
    expect(await appStats.json()).toMatchObject({ error: 'no_access_to_app' })

    const orgStats = await app.request('https://api.test/statistics/org/org-1?from=1&to=2', { headers: authHeaders }, env)
    expect(orgStats.status).toBe(401)
    expect(await orgStats.json()).toMatchObject({ error: 'no_access_to_organization' })
  })

  it('returns device and channel access errors', async () => {
    const { app, env } = testApp()
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.errors', name: 'com.example.errors', owner_org: 'default-org' }),
    }, env)

    const missingDeviceQuery = await app.request('https://api.test/device', { headers: authHeaders }, env)
    expect(missingDeviceQuery.status).toBe(400)

    const inaccessibleDevice = await app.request('https://api.test/device?device_id=device-1&app_id=nonexistent.app.id', { headers: authHeaders }, env)
    expect(inaccessibleDevice.status).toBe(400)
    expect(await inaccessibleDevice.json()).toMatchObject({ error: 'cannot_access_app' })

    const inaccessibleChannel = await app.request('https://api.test/channel?name=test-channel&app_id=nonexistent.app.id', { headers: authHeaders }, env)
    expect(inaccessibleChannel.status).toBe(400)
    expect(await inaccessibleChannel.json()).toMatchObject({ error: 'cannot_access_app' })

    const missingChannelName = await app.request('https://api.test/channel', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.errors' }),
    }, env)
    expect(missingChannelName.status).toBe(400)
    expect(await missingChannelName.json()).toMatchObject({ error: 'missing_channel_name' })
  })

  it('returns trigger and private upload errors', async () => {
    const { app, env } = testApp()

    const cronApp = await app.request('https://api.test/triggers/cron_stat_app', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }, env)
    expect(await cronApp.json()).toMatchObject({ error: 'no_appId' })

    const cronOrg = await app.request('https://api.test/triggers/cron_stat_org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }, env)
    expect(await cronOrg.json()).toMatchObject({ error: 'no_orgId' })

    const cronEmailMissing = await app.request('https://api.test/triggers/cron_email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }, env)
    expect(await cronEmailMissing.json()).toMatchObject({ error: 'missing_email_type' })

    const cronEmailInvalid = await app.request('https://api.test/triggers/cron_email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', type: 'invalid_type' }),
    }, env)
    expect(await cronEmailInvalid.json()).toMatchObject({ error: 'invalid_stats_type' })

    const uploadLink = await app.request('https://api.test/private/upload_link', {
      method: 'POST',
      headers: { authorization: 'invalid-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: 'com.example.errors', name: '1.0.0' }),
    }, env)
    expect(uploadLink.status).toBe(401)
    expect(await uploadLink.json()).toMatchObject({ error: 'invalid_apikey' })
  })
})
