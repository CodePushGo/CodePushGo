export type TranslationStatus = 'pending' | 'ready'

export interface TranslationStoreEntry {
  checksum: string
  messages: Record<string, string>
  model: string
  nextBatchIndex: number
  status: TranslationStatus
  targetLanguage: string
  updatedAt: number
}

export interface TranslationQueueMessage {
  batchIndex: number
  checksum: string
  model: string
  targetLanguage: string
}

export interface TranslationRequestDeps {
  latestReadyEntry?: TranslationStoreEntry | null
  now?: number
  queue?: { send: (message: TranslationQueueMessage) => Promise<unknown> | unknown }
  sourceMessages: Record<string, string>
}

export const TRANSLATION_BATCH_SIZE = 60
export const TRANSLATION_BATCH_CLAIM_OFFSET = 100_000
export const TRANSLATION_BATCH_LEASE_SECONDS = 15 * 60
export const READY_TRANSLATION_FRESH_SECONDS = 5 * 60
export const DEFAULT_TRANSLATION_MODEL = '@cf/meta/m2m100-1.2b'

const publicGenerationLanguages = new Set(['fr', 'de', 'es', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'zh'])

export function buildBatches(messages: Record<string, string>, batchSize = TRANSLATION_BATCH_SIZE) {
  const entries = Object.entries(messages)
  const batches: Array<Array<[string, string]>> = []
  for (let index = 0; index < entries.length; index += batchSize)
    batches.push(entries.slice(index, index + batchSize))
  return batches
}

export function keepTranslation(source: string, translated: string) {
  return placeholders(source).every(placeholder => translated.includes(placeholder)) ? translated : source
}

export function normalizeBatchIndex(index: number) {
  return Number.isInteger(index) && index >= 0 ? index : 0
}

export function translationBatchClaimMarker(index: number) {
  return TRANSLATION_BATCH_CLAIM_OFFSET + normalizeBatchIndex(index)
}

export function claimedTranslationBatchIndex(index: number) {
  return index >= TRANSLATION_BATCH_CLAIM_OFFSET ? index - TRANSLATION_BATCH_CLAIM_OFFSET : null
}

export function translationBatchIndexFromStore(index: number) {
  return claimedTranslationBatchIndex(index) ?? normalizeBatchIndex(index)
}

export function translationStoreTtlSeconds(entry: Pick<TranslationStoreEntry, 'status'>) {
  return entry.status === 'ready' ? 60 * 60 * 24 * 30 : 60 * 60
}

export function isTranslationBatchLeaseExpired(entry: Pick<TranslationStoreEntry, 'nextBatchIndex' | 'updatedAt'>, now = Math.floor(Date.now() / 1000)) {
  if (claimedTranslationBatchIndex(entry.nextBatchIndex) === null)
    return true
  return now - entry.updatedAt > TRANSLATION_BATCH_LEASE_SECONDS
}

export function isReadyTranslationFresh(entry: Pick<TranslationStoreEntry, 'status' | 'updatedAt'>, now = Math.floor(Date.now() / 1000)) {
  return entry.status === 'ready' && now - entry.updatedAt < READY_TRANSLATION_FRESH_SECONDS
}

export function isPublicGenerationLanguage(targetLanguage: string) {
  return publicGenerationLanguages.has(normalizeLanguage(targetLanguage))
}

export async function handleTranslationMessages(targetLanguage: string, deps: TranslationRequestDeps) {
  const language = normalizeLanguage(targetLanguage)
  if (!isPublicGenerationLanguage(language)) {
    return jsonResponse({ error: 'unsupported_translation_language', message: 'Target language is not enabled' }, 400)
  }

  const now = deps.now ?? Math.floor(Date.now() / 1000)
  const checksum = checksumMessages(deps.sourceMessages)
  const latestReadyEntry = deps.latestReadyEntry ?? null

  if (latestReadyEntry && isReadyTranslationFresh(latestReadyEntry, now)) {
    return jsonResponse({ checksum: latestReadyEntry.checksum, messages: latestReadyEntry.messages, model: latestReadyEntry.model, status: 'ready' }, 200, {
      'x-codepushgo-translation-stale': latestReadyEntry.checksum === checksum ? '0' : '1',
    })
  }

  await deps.queue?.send({ batchIndex: 0, checksum, model: latestReadyEntry?.model ?? DEFAULT_TRANSLATION_MODEL, targetLanguage: language })

  if (latestReadyEntry) {
    return jsonResponse({ checksum: latestReadyEntry.checksum, messages: latestReadyEntry.messages, model: latestReadyEntry.model, status: 'ready' }, 200, {
      'x-codepushgo-translation-stale': '1',
    })
  }

  return jsonResponse({ checksum, status: 'pending' }, 202)
}

export async function handleTranslationQueueMessage(message: TranslationQueueMessage, deps: { ai?: { run: (...args: unknown[]) => Promise<unknown> | unknown } }) {
  if (!isPublicGenerationLanguage(message.targetLanguage))
    return 'ignored'
  await deps.ai?.run(message.model, message)
  return 'processed'
}

function placeholders(value: string) {
  return value.match(/\{[^}]+\}/g) ?? []
}

function normalizeLanguage(value: string) {
  return value.trim().toLowerCase()
}

function checksumMessages(messages: Record<string, string>) {
  return String(Object.entries(messages).sort(([a], [b]) => a.localeCompare(b)).reduce((hash, [key, value]) => {
    const input = `${key}\0${value}\0`
    let next = hash
    for (let index = 0; index < input.length; index += 1)
      next = ((next << 5) - next + input.charCodeAt(index)) | 0
    return next
  }, 0) >>> 0)
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
      ...headers,
    },
  })
}
