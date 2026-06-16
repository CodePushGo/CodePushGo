import { describe, expect, it } from 'vitest'
import { processVisibleQueueBatch, type InMemoryQueueMessage } from '../src/queue-consumer'
import { testApp } from './helpers'

describe('[Capgo parity] queue_load trigger endpoints', () => {
  it('returns health status for the queue consumer', async () => {
    const { app, env } = testApp()

    const response = await app.request('/triggers/queue_consumer/health', {}, env)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })

  it('accepts a valid queue sync trigger', async () => {
    const { app, env } = testApp()

    const response = await app.request('/triggers/queue_consumer/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queue_name: 'function_call', batch_size: 10 }),
    }, env)

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects malformed queue sync payloads with Capgo-compatible errors', async () => {
    const { app, env } = testApp()

    const missingQueueName = await app.request('/triggers/queue_consumer/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }, env)
    expect(missingQueueName.status).toBe(400)
    expect(await missingQueueName.json()).toEqual({ error: 'missing_or_invalid_queue_name' })

    const numericQueueName = await app.request('/triggers/queue_consumer/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queue_name: 42 }),
    }, env)
    expect(numericQueueName.status).toBe(400)
    expect(await numericQueueName.json()).toEqual({ error: 'missing_or_invalid_queue_name' })

    const invalidJson = await app.request('/triggers/queue_consumer/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }, env)
    expect(invalidJson.status).toBe(400)
    expect(await invalidJson.json()).toEqual({ error: 'invalid_json_parse_body' })
  })

  it('processes visible in-memory queue batches deterministically', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    const queue: Array<InMemoryQueueMessage<{ index: number }>> = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      message: { index },
      visibleAt: now.getTime(),
      readCount: 0,
    }))
    const archived: Array<InMemoryQueueMessage<{ index: number }>> = []

    const first = processVisibleQueueBatch(queue, archived, { now, batchSize: 2 })
    const second = processVisibleQueueBatch(queue, archived, { now, batchSize: 10 })

    expect(first.processedCount).toBe(2)
    expect(first.remainingCount).toBe(3)
    expect(second.processedCount).toBe(3)
    expect(second.remainingCount).toBe(0)
    expect(second.archived.map(message => message.id)).toEqual([1, 2, 3, 4, 5])
  })
})
