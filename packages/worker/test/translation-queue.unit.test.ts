import { describe, expect, it, vi } from 'vitest'
import {
  buildBatches,
  claimedTranslationBatchIndex,
  handleTranslationMessages,
  handleTranslationQueueMessage,
  isReadyTranslationFresh,
  isTranslationBatchLeaseExpired,
  keepTranslation,
  normalizeBatchIndex,
  translationBatchClaimMarker,
  translationBatchIndexFromStore,
  translationStoreTtlSeconds,
  type TranslationStoreEntry,
} from '../src/translation-queue'

const sourceMessages = Object.fromEntries(Array.from({ length: 125 }, (_, index) => [`key-${index}`, `Message ${index} with {count}`]))

function readyEntry(input: Partial<TranslationStoreEntry> = {}): TranslationStoreEntry {
  return {
    checksum: 'previous-checksum',
    messages: { account: 'Compte' },
    model: 'model',
    nextBatchIndex: 1,
    status: 'ready',
    targetLanguage: 'fr',
    updatedAt: Math.floor(Date.now() / 1000) - 30,
    ...input,
  }
}

describe('[Capgo parity] translation queue helpers', () => {
  it.concurrent('splits the English catalog into bounded queue batches', () => {
    const batches = buildBatches(sourceMessages)

    expect(batches.length).toBeGreaterThan(1)
    expect(batches.every(batch => batch.length <= 60)).toBe(true)
  })

  it.concurrent('keeps source text when translation drops a placeholder', () => {
    expect(keepTranslation('Used {count} times', 'Utilise plusieurs fois')).toBe('Used {count} times')
  })

  it.concurrent('normalizes invalid queued batch indexes to the first batch', () => {
    expect(normalizeBatchIndex(-1)).toBe(0)
    expect(normalizeBatchIndex(1.5)).toBe(0)
    expect(normalizeBatchIndex(2)).toBe(2)
  })

  it.concurrent('maps claimed queue batch indexes back to their batch', () => {
    const marker = translationBatchClaimMarker(2)

    expect(marker).toBeGreaterThan(2)
    expect(claimedTranslationBatchIndex(marker)).toBe(2)
    expect(claimedTranslationBatchIndex(2)).toBeNull()
    expect(translationBatchIndexFromStore(marker)).toBe(2)
  })

  it.concurrent('keeps ready translations long enough to reuse while pending refreshes', () => {
    expect(translationStoreTtlSeconds({ status: 'ready' })).toBeGreaterThan(
      translationStoreTtlSeconds({ status: 'pending' }),
    )
  })

  it.concurrent('keeps active batch claims leased past stale polling checks', () => {
    const now = Math.floor(Date.now() / 1000)
    const entry = readyEntry({
      nextBatchIndex: translationBatchClaimMarker(0),
      status: 'pending',
      updatedAt: now - 61,
    })

    expect(isTranslationBatchLeaseExpired(entry, now)).toBe(false)
    expect(isTranslationBatchLeaseExpired({ ...entry, updatedAt: now - (15 * 60 + 1) }, now)).toBe(true)
  })

  it.concurrent('checks ready translation freshness with a 5 minute window', () => {
    const now = Math.floor(Date.now() / 1000)

    expect(isReadyTranslationFresh(readyEntry({ updatedAt: now - 299 }), now)).toBe(true)
    expect(isReadyTranslationFresh(readyEntry({ updatedAt: now - 300 }), now)).toBe(false)
  })

  it('serves a recent saved translation without queueing a refresh', async () => {
    const queue = { send: vi.fn() }
    const response = await handleTranslationMessages('fr', {
      latestReadyEntry: readyEntry(),
      queue,
      sourceMessages,
    })
    const payload = await response.json() as { checksum: string, messages: Record<string, string>, model: string, status: string }

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-codepushgo-translation-stale')).toBe('1')
    expect(payload).toEqual({
      checksum: 'previous-checksum',
      messages: { account: 'Compte' },
      model: 'model',
      status: 'ready',
    })
    expect(queue.send).not.toHaveBeenCalled()
  })

  it('serves the last saved translation and queues a refresh when the checksum changed', async () => {
    const now = Math.floor(Date.now() / 1000)
    const queue = { send: vi.fn() }
    const response = await handleTranslationMessages('fr', {
      latestReadyEntry: readyEntry({ updatedAt: now - 301 }),
      now,
      queue,
      sourceMessages,
    })
    const payload = await response.json() as { checksum: string, status: string }

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(payload.status).toBe('ready')
    expect(payload.checksum).toBe('previous-checksum')
    expect(queue.send).toHaveBeenCalledTimes(1)
  })

  it('queues the first translation and tells the frontend to retry later', async () => {
    const queue = { send: vi.fn() }
    const response = await handleTranslationMessages('fr', {
      latestReadyEntry: null,
      queue,
      sourceMessages,
    })
    const payload = await response.json() as { status: string }

    expect(response.status).toBe(202)
    expect(payload.status).toBe('pending')
    expect(queue.send).toHaveBeenCalledTimes(1)
  })

  it('rejects supported aliases outside the public generation allow-list before queueing', async () => {
    const queue = { send: vi.fn() }
    const response = await handleTranslationMessages('pt-br', {
      queue,
      sourceMessages,
    })
    const payload = await response.json() as { error: string, message: string }

    expect(response.status).toBe(400)
    expect(payload.error).toBe('unsupported_translation_language')
    expect(payload.message).toBe('Target language is not enabled')
    expect(queue.send).not.toHaveBeenCalled()
  })

  it('ignores queued translations outside the generation allow-list before AI work', async () => {
    const ai = { run: vi.fn() }

    await expect(handleTranslationQueueMessage({
      batchIndex: 0,
      checksum: 'checksum',
      model: 'model',
      targetLanguage: 'pt-br',
    }, { ai })).resolves.toBe('ignored')

    expect(ai.run).not.toHaveBeenCalled()
  })
})
