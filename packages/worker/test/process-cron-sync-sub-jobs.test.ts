import { describe, expect, it } from 'vitest'
import { createCronSyncSubQueueMessage } from '../src/cron-queues'

describe('[Capgo parity] process_cron_sync_sub_jobs', () => {
  it.concurrent('queues cron_sync_sub with the standard payload envelope', () => {
    expect(createCronSyncSubQueueMessage({ orgId: 'org-cron', customerId: 'cus_cron' })).toEqual({
      function_name: 'cron_sync_sub',
      function_type: null,
      payload: {
        orgId: 'org-cron',
        customerId: 'cus_cron',
      },
    })
  })
})
