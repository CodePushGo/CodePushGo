import { describe, expect, it, vi } from 'vitest'
import { runCronSyncSub } from '../src/cron-sync-sub'
import { testApp } from './helpers'

describe('[Capgo parity] cron_sync_sub resilience', () => {
  it('retries transient cron_sync_sub failures and succeeds', async () => {
    const sync = vi.fn()
      .mockRejectedValueOnce({ status: 502, message: 'error code: 502' })
      .mockResolvedValueOnce(undefined)

    await expect(runCronSyncSub({ orgId: 'org-retry' }, { sync })).resolves.toEqual({ status: 'ok' })
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('skips stale cron_sync_sub jobs when the org no longer exists', async () => {
    const error = new Error('Org not found') as Error & { status: number, cause: { error: string } }
    error.status = 404
    error.cause = { error: 'org_not_found' }
    const sync = vi.fn().mockRejectedValue(error)

    await expect(runCronSyncSub({ orgId: 'org-missing' }, { sync })).resolves.toEqual({ status: 'skipped', reason: 'org_not_found' })
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('exposes the Worker trigger and records a successful customer sync marker', async () => {
    const { app, env, storage } = testApp()
    await storage.upsertOrganization({ id: 'org-sync', name: 'Org Sync', customerId: 'cus_sync' })

    const response = await app.request('/triggers/cron_sync_sub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-sync', customerId: 'cus_sync' }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(await storage.getStripeInfoByCustomerId('cus_sync')).toMatchObject({ status: 'succeeded', isGoodPlan: true })
  })

  it('skips stale Worker trigger jobs for deleted organizations', async () => {
    const { app, env } = testApp()

    const response = await app.request('/triggers/cron_sync_sub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-missing' }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'skipped', reason: 'org_not_found' })
  })
})
