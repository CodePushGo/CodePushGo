import { describe, expect, it } from 'vitest'
import { createCronStatOrgQueueMessage, shouldQueueCronStatOrg } from '../src/cron-queues'

describe('[Capgo parity] queue_cron_stat_org_for_org', () => {
  it('creates the Cloudflare cron_stat_org queue message shape', () => {
    expect(createCronStatOrgQueueMessage({ orgId: 'org-1', customerId: 'cus_123' })).toEqual({
      function_name: 'cron_stat_org',
      function_type: 'cloudflare',
      payload: {
        orgId: 'org-1',
        customerId: 'cus_123',
      },
    })
  })

  it('queues org stats when plan calculation is missing or stale', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')

    expect(shouldQueueCronStatOrg(null, now)).toBe(true)
    expect(shouldQueueCronStatOrg(undefined, now)).toBe(true)
    expect(shouldQueueCronStatOrg('2026-06-15T10:59:59.000Z', now)).toBe(true)
    expect(shouldQueueCronStatOrg('2026-06-15T11:30:00.000Z', now)).toBe(false)
  })

  it('treats invalid timestamps as needing recalculation', () => {
    expect(shouldQueueCronStatOrg('not-a-date', new Date('2026-06-15T12:00:00.000Z'))).toBe(true)
  })
})
