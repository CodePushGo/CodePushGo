export const MAX_QUEUE_READS = 3

export interface QueueMessage<T = Record<string, unknown>> {
  msg_id: number
  read_ct: number
  message: T & {
    function_name?: string
    function_type?: string | null
    payload?: Record<string, unknown>
  }
}

export interface QueueFailure {
  cf_id: string
  error_code?: string | null
  function_name: string
  function_type: string | null
  msg_id: number
  payload_size: number
  read_count: number
  status: number
  status_text: string
}

const ignoredQueueErrorCodes = new Set(['version_not_found'])
const manifestRetryErrorCodes = new Set(['manifest_size_not_found'])

export function extractMessageBody(message: QueueMessage): Record<string, unknown> {
  if (isRecord(message.message.payload))
    return { ...message.message.payload }
  const { function_name: _functionName, function_type: _functionType, payload: _payload, ...body } = message.message
  return body
}

export function getQueueMessageTrace(functionName: string, body: Record<string, unknown>) {
  if (functionName !== 'on_version_update')
    return null
  const record = isRecord(body.record) ? body.record : {}
  const oldRecord = isRecord(body.old_record) ? body.old_record : {}
  return {
    app_id: record.app_id,
    deleted_at: record.deleted_at,
    id: record.id,
    manifest_count: record.manifest_count,
    manifest_entries: Array.isArray(record.manifest) ? record.manifest.length : undefined,
    old_deleted_at: oldRecord.deleted_at,
    old_r2_path: oldRecord.r2_path,
    old_storage_provider: oldRecord.storage_provider,
    old_updated_at: oldRecord.updated_at,
    r2_path: record.r2_path,
    storage_provider: record.storage_provider,
    updated_at: record.updated_at,
    version_name: record.name,
  }
}

export function getActionableQueueFailures(failures: QueueFailure[]) {
  return failures.filter((failure) => {
    if (failure.read_count < MAX_QUEUE_READS)
      return false
    if (failure.error_code && ignoredQueueErrorCodes.has(failure.error_code))
      return false
    if (failure.error_code && manifestRetryErrorCodes.has(failure.error_code) && failure.read_count < MAX_QUEUE_READS)
      return false
    return true
  })
}

export function getQueueBatchSize(functionName: string, requested: number) {
  return functionName === 'on_manifest_create' ? Math.min(requested, 100) : requested
}

export function getQueueHttpConcurrency(functionName: string) {
  return functionName === 'on_manifest_create' ? 10 : 25
}

export function sanitizeDiscordResponseBody(input: string) {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/("(?:token|authorization)"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_TOKEN]$2')
    .replace(/[A-F0-9]{32}/g, '[REDACTED]')
}

export async function extractErrorDetails(response: Response) {
  const bodyPreview = await response.clone().text()
  let errorCode: string | null = null
  let errorMessage = response.statusText || null
  try {
    const parsed = JSON.parse(bodyPreview) as Record<string, unknown>
    errorCode = typeof parsed.error === 'string' ? parsed.error : null
    errorMessage = typeof parsed.message === 'string' ? parsed.message : errorMessage
  }
  catch {}
  return { bodyPreview, errorCode, errorMessage }
}

export function queueFailureResponse(error: string, message: string, details: Record<string, unknown>) {
  return new Response(JSON.stringify({ error, message, ...details }), {
    status: 599,
    statusText: 'Queue Message Failed',
    headers: { 'content-type': 'application/json' },
  })
}

export function httpExceptionToQueueResponse(error: { status?: number, message?: string, cause?: unknown }) {
  if (!error.status)
    return null
  const cause = isRecord(error.cause) ? error.cause : {}
  return new Response(JSON.stringify({
    error: typeof cause.error === 'string' ? cause.error : null,
    message: typeof cause.message === 'string' ? cause.message : error.message ?? 'Queue handler failed',
    moreInfo: cause.moreInfo,
  }), {
    status: error.status,
    statusText: error.message,
    headers: { 'content-type': 'application/json' },
  })
}

export async function maybePingCronHealthcheck(summary: { actionableFailureCount: number, failedCount: number, processedCount: number }, url: string | null | undefined, fetchImpl: typeof fetch = fetch) {
  if (!url || summary.actionableFailureCount > 0 || summary.failedCount > 0 || summary.processedCount <= 0)
    return false
  const response = await fetchImpl(url)
  return response.ok
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface InMemoryQueueMessage<T = Record<string, unknown>> {
  id: number
  message: T
  visibleAt: number
  readCount: number
}

export interface ProcessQueueArchiveResult<T = Record<string, unknown>> {
  processedCount: number
  remainingCount: number
  archived: Array<InMemoryQueueMessage<T>>
}

export function processVisibleQueueBatch<T>(queue: Array<InMemoryQueueMessage<T>>, archived: Array<InMemoryQueueMessage<T>>, input: { now?: Date, batchSize: number }): ProcessQueueArchiveResult<T> {
  const nowMs = (input.now ?? new Date()).getTime()
  const visible = queue
    .filter(message => message.visibleAt <= nowMs)
    .sort((a, b) => a.id - b.id)
    .slice(0, Math.max(0, input.batchSize))
  const visibleIds = new Set(visible.map(message => message.id))

  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (visibleIds.has(queue[index].id))
      queue.splice(index, 1)
  }
  archived.push(...visible.map(message => ({ ...message })))

  return {
    processedCount: visible.length,
    remainingCount: queue.length,
    archived: [...archived],
  }
}
