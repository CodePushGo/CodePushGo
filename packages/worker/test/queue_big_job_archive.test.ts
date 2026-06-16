import { describe, expect, it } from 'vitest'
import { processVisibleQueueBatch, type InMemoryQueueMessage } from '../src/queue-consumer'

const MESSAGE_COUNT = 950
const SYNC_BATCH_SIZE = 200

describe('[Capgo parity] queue_big_job_archive', () => {
  it.concurrent('processes 950 visible jobs in batches and archives each processed message', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    const queue: Array<InMemoryQueueMessage> = Array.from({ length: MESSAGE_COUNT }, (_, index) => ({
      id: index + 1,
      message: { payload: { appId: '', orgId: '', todayOnly: false }, function_name: '', function_type: '' },
      visibleAt: now.getTime() - 100_000,
      readCount: 10,
    }))
    const archive: Array<InMemoryQueueMessage> = []

    let safety = 0
    while (queue.length > 0) {
      safety += 1
      expect(safety).toBeLessThanOrEqual(20)
      processVisibleQueueBatch(queue, archive, { now, batchSize: SYNC_BATCH_SIZE })
    }

    expect(queue).toHaveLength(0)
    expect(archive).toHaveLength(MESSAGE_COUNT)
    expect(archive.map(message => message.id)).toEqual(Array.from({ length: MESSAGE_COUNT }, (_, index) => index + 1))
  })
})
