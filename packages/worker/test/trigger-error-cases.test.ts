import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

const jsonHeaders = { 'content-type': 'application/json' }

async function postTrigger(path: string, body: unknown) {
  const { app, env } = testApp()
  const response = await app.request(`https://api.test${path}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  }, env)
  return response
}

describe('[Capgo parity] trigger error cases', () => {
  it('validates cron_stat_app payloads and skips stale deleted-app jobs', async () => {
    const { app, env } = testApp()

    const missingApp = await app.request('https://api.test/triggers/cron_stat_app', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    }, env)
    expect(missingApp.status).toBe(400)
    expect(await missingApp.json()).toMatchObject({ error: 'no_appId' })

    const missingOrg = await app.request('https://api.test/triggers/cron_stat_app', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ appId: 'nonexistent-app-id' }),
    }, env)
    expect(missingOrg.status).toBe(400)
    expect(await missingOrg.json()).toMatchObject({ error: 'no_orgId' })

    const stale = await app.request('https://api.test/triggers/cron_stat_app', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ appId: 'nonexistent-app-id', orgId: 'default-org' }),
    }, env)
    expect(stale.status).toBe(200)
    expect(await stale.json()).toEqual({ status: 'skipped', reason: 'app_not_found' })
  })

  it('validates cron_stat_org payloads', async () => {
    const response = await postTrigger('/triggers/cron_stat_org', {})
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'no_orgId' })
  })

  it('validates cron_email payloads in Capgo-compatible order', async () => {
    const missingEmailType = await postTrigger('/triggers/cron_email', {})
    expect(missingEmailType.status).toBe(400)
    expect(await missingEmailType.json()).toMatchObject({ error: 'missing_email_type' })

    const missingApp = await postTrigger('/triggers/cron_email', { email: 'test@example.com', type: 'stats' })
    expect(missingApp.status).toBe(400)
    expect(await missingApp.json()).toMatchObject({ error: 'missing_appId' })

    const missingOrg = await postTrigger('/triggers/cron_email', { email: 'test@example.com', type: 'billing_period_stats' })
    expect(missingOrg.status).toBe(400)
    expect(await missingOrg.json()).toMatchObject({ error: 'missing_orgId' })

    const invalidType = await postTrigger('/triggers/cron_email', { email: 'test@example.com', appId: 'com.trigger.test', type: 'invalid_type' })
    expect(invalidType.status).toBe(400)
    expect(await invalidType.json()).toMatchObject({ error: 'invalid_stats_type' })

    const missingVersion = await postTrigger('/triggers/cron_email', { email: 'test@example.com', appId: 'com.trigger.test', type: 'deploy_install_stats' })
    expect(missingVersion.status).toBe(400)
    expect(await missingVersion.json()).toMatchObject({ error: 'missing_version_id' })
  })

  it('validates miscellaneous trigger guard routes', async () => {
    const clearVersions = await postTrigger('/triggers/cron_clear_versions', {})
    expect(clearVersions.status).toBe(500)
    expect(await clearVersions.json()).toMatchObject({ error: 'no_version' })

    const wrongChannelTable = await postTrigger('/triggers/on_channel_update', { table: 'not_channels', type: 'UPDATE', record: {}, old_record: {} })
    expect(wrongChannelTable.status).toBe(400)
    expect(await wrongChannelTable.json()).toMatchObject({ error: 'table_not_match' })

    const wrongChannelType = await postTrigger('/triggers/on_channel_update', { table: 'channels', type: 'INSERT', record: {}, old_record: {} })
    expect(wrongChannelType.status).toBe(400)
    expect(await wrongChannelType.json()).toMatchObject({ error: 'type_not_match' })

    const missingChannelApp = await postTrigger('/triggers/on_channel_update', { table: 'channels', type: 'UPDATE', record: { id: 'missing' }, old_record: {} })
    expect(missingChannelApp.status).toBe(500)
    expect(await missingChannelApp.json()).toMatchObject({ error: 'no_app_id' })
  })

  it('validates create/update trigger payloads', async () => {
    const missingOrg = await postTrigger('/triggers/on_app_create', { table: 'apps', type: 'INSERT', record: { id: 'app-id', app_id: 'test.app', owner_org: 'missing-org' } })
    expect(missingOrg.status).toBe(400)
    expect(await missingOrg.json()).toMatchObject({ error: 'error_fetching_organization' })

    const invalidApp = await postTrigger('/triggers/on_app_create', { table: 'apps', type: 'INSERT', record: { id: null, app_id: null } })
    expect(invalidApp.status).toBe(400)
    expect(await invalidApp.json()).toMatchObject({ error: 'no_id' })

    const missingVersionId = await postTrigger('/triggers/on_version_create', { table: 'app_versions', type: 'INSERT', record: { id: null, app_id: null } })
    expect(missingVersionId.status).toBe(400)
    expect(await missingVersionId.json()).toMatchObject({ error: 'no_id' })

    const deployHistory = await postTrigger('/triggers/on_deploy_history_create', { table: 'app_versions_meta', type: 'INSERT', record: { id: null } })
    expect(deployHistory.status).toBe(400)
    expect(await deployHistory.json()).toMatchObject({ error: 'table_not_match' })

    const manifest = await postTrigger('/triggers/on_manifest_create', { table: 'manifest', type: 'INSERT', record: { id: 'manifest-id', app_id: 'invalid.app', size: 'invalid-size' } })
    expect(manifest.status).toBe(400)
    expect(await manifest.json()).toMatchObject({ error: 'no_app_version_id_or_s3_path' })
  })

  it('validates on_version_update and stripe event trigger errors', async () => {
    const wrongVersionTable = await postTrigger('/triggers/on_version_update', { table: 'not_app_versions', type: 'UPDATE', record: {}, old_record: {} })
    expect(wrongVersionTable.status).toBe(400)
    expect(await wrongVersionTable.json()).toMatchObject({ error: 'table_not_match' })

    const wrongVersionType = await postTrigger('/triggers/on_version_update', { table: 'app_versions', type: 'INSERT', record: {}, old_record: {} })
    expect(wrongVersionType.status).toBe(400)
    expect(await wrongVersionType.json()).toMatchObject({ error: 'type_not_match' })

    const stripeEvent = await postTrigger('/triggers/stripe_event', { type: 'invalid.event.type', data: {} })
    expect(stripeEvent.status).toBe(500)
    expect(await stripeEvent.json()).toMatchObject({ error: 'webhook_error_no_signature' })
  })
})
