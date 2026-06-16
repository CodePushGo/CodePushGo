import { describe, expect, it } from 'vitest'
import { buildCronStatAppQueueMessages, createCronStatAppQueueMessage } from '../src/cron-queues'

describe('[Capgo parity] process_cron_stats_jobs', () => {
  const now = new Date('2026-06-15T12:00:00.000Z')

  it.concurrent('queues active apps even when first-seen MAU leaves daily_mau quiet', () => {
    const messages = buildCronStatAppQueueMessages([
      {
        appId: 'com.cron.queue',
        orgId: 'org-cron',
        newestVersionCreatedAt: '2026-05-01T12:00:00.000Z',
        latestDeviceUsageAt: '2026-06-15T11:50:00.000Z',
        latestBandwidthUsageAt: '2026-06-15T11:51:00.000Z',
        latestDailyMauAt: null,
      },
    ], now)

    expect(messages).toEqual([
      createCronStatAppQueueMessage({ appId: 'com.cron.queue', orgId: 'org-cron', todayOnly: false }),
    ])
  })

  it.concurrent('does not queue inactive apps with no recent usage signals', () => {
    expect(buildCronStatAppQueueMessages([
      {
        appId: 'com.cron.inactive',
        orgId: 'org-cron',
        newestVersionCreatedAt: '2026-05-01T12:00:00.000Z',
        latestDeviceUsageAt: '2026-06-10T11:50:00.000Z',
        latestBandwidthUsageAt: null,
        latestDailyMauAt: null,
      },
    ], now)).toEqual([])
  })
})
