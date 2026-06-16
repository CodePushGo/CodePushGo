import { describe, expect, it, vi } from 'vitest'
import {
  extractErrorDetails,
  extractMessageBody,
  getActionableQueueFailures,
  getQueueBatchSize,
  getQueueHttpConcurrency,
  getQueueMessageTrace,
  httpExceptionToQueueResponse,
  MAX_QUEUE_READS,
  maybePingCronHealthcheck,
  queueFailureResponse,
  sanitizeDiscordResponseBody,
  type QueueMessage,
} from '../src/queue-consumer'

describe('[Capgo parity] queue_consumer legacy message compatibility', () => {
  it.concurrent('uses the payload envelope when it is present', () => {
    const message: QueueMessage = { msg_id: 1, read_ct: 0, message: { function_name: 'cron_sync_sub', function_type: 'cloudflare', payload: { orgId: 'org-1', customerId: 'cus_1' } } }
    expect(extractMessageBody(message)).toEqual({ orgId: 'org-1', customerId: 'cus_1' })
  })

  it.concurrent('falls back to legacy top-level fields when payload is missing', () => {
    const message: QueueMessage = { msg_id: 2, read_ct: 0, message: { function_name: 'cron_sync_sub', orgId: 'org-legacy', customerId: 'cus_legacy' } }
    expect(extractMessageBody(message)).toEqual({ orgId: 'org-legacy', customerId: 'cus_legacy' })
  })

  it.concurrent('summarizes app version update queue payloads for logs', () => {
    expect(getQueueMessageTrace('on_version_update', {
      old_record: { deleted_at: null, r2_path: null, storage_provider: 'r2-direct', updated_at: '2026-06-10T17:33:48.108Z' },
      record: { app_id: 'at.pulserunning.rny', deleted_at: null, id: 181090948, manifest: [{ file_name: 'index.html' }, { file_name: 'assets/app.js' }], manifest_count: 0, name: '1.7.0', r2_path: 'orgs/org-id/apps/at.pulserunning.rny/1.7.0.zip', storage_provider: 'r2', updated_at: '2026-06-10T17:33:48.559Z' },
    })).toMatchObject({ app_id: 'at.pulserunning.rny', manifest_entries: 2, version_name: '1.7.0', old_storage_provider: 'r2-direct' })
  })

  it.concurrent('alerts only after retry budget is exhausted and ignores known non-actionable errors', () => {
    const retrying = { cf_id: 'cf-1', function_name: 'on_version_update', function_type: 'supabase', msg_id: 1, payload_size: 10, read_count: 1, status: 502, status_text: 'Bad Gateway' }
    const actionable = { ...retrying, read_count: MAX_QUEUE_READS, status: 500, status_text: 'Internal Server Error' }
    const ignored = { ...actionable, error_code: 'version_not_found' }
    expect(getActionableQueueFailures([retrying, actionable, ignored])).toEqual([actionable])
  })

  it.concurrent('caps manifest queue batches and concurrency to avoid storage bursts', () => {
    expect(getQueueBatchSize('on_manifest_create', 950)).toBe(100)
    expect(getQueueBatchSize('cron_email', 950)).toBe(950)
    expect(getQueueHttpConcurrency('on_manifest_create')).toBe(10)
    expect(getQueueHttpConcurrency('cron_email')).toBe(25)
  })

  it.concurrent('redacts sensitive data before queue failures are sent to Discord', () => {
    const sanitized = sanitizeDiscordResponseBody(JSON.stringify({ authorization: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890', email: 'alice@capgo.app', token: 'super-secret-token-value', traceId: 'ABCDEF0123456789ABCDEF0123456789' }))
    expect(sanitized).toContain('[REDACTED_EMAIL]')
    expect(sanitized).toContain('[REDACTED_TOKEN]')
    expect(sanitized).toContain('[REDACTED]')
    expect(sanitized).not.toContain('alice@capgo.app')
    expect(sanitized).not.toContain('super-secret-token-value')
  })

  it.concurrent('keeps message-only JSON error details actionable', async () => {
    const details = await extractErrorDetails(new Response(JSON.stringify({ message: 'builder unavailable' }), { headers: { 'content-type': 'application/json' }, status: 503, statusText: 'Service Unavailable' }))
    expect(details).toEqual({ bodyPreview: '{"message":"builder unavailable"}', errorCode: null, errorMessage: 'builder unavailable' })
  })

  it.concurrent('turns queue transport failures into retryable per-message responses', async () => {
    const response = queueFailureResponse('queue_message_failed', 'fetch failed', { cfId: 'cf-transport', msgId: 12, queueName: 'on_manifest_create', targetUrl: 'direct:on_manifest_create' })
    const details = await extractErrorDetails(response)
    expect(response.status).toBe(599)
    expect(details.errorCode).toBe('queue_message_failed')
    expect(details.errorMessage).toBe('fetch failed')
  })

  it.concurrent('preserves direct handler HTTP error details for queue retries', async () => {
    const response = httpExceptionToQueueResponse({ status: 503, message: 'Manifest file size metadata was not found', cause: { error: 'manifest_size_not_found', message: 'Manifest file size metadata was not found', moreInfo: { id: 123 } } })
    expect(response).not.toBeNull()
    await expect(extractErrorDetails(response!)).resolves.toMatchObject({ errorCode: 'manifest_size_not_found', errorMessage: 'Manifest file size metadata was not found' })
  })

  it.concurrent('calls the healthcheck URL when the worker succeeds', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch
    await expect(maybePingCronHealthcheck({ actionableFailureCount: 0, failedCount: 0, processedCount: 1 }, 'https://hc.test/ping', fetchImpl)).resolves.toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith('https://hc.test/ping')
  })
})
