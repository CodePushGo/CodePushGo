import type { Context } from 'hono'
import { getClientIP } from './rate-limit'

const UPDATE_ENUMERATION_PATH = '/rate-limit/update-enumeration/slot'
const CACHE_NAME = 'codepushgo-update-enumeration'
const SLOT_COUNT = 8
const DEFAULT_LIMIT = 20
const TTL_SECONDS = 60 * 15

interface EnumerationSlotData {
  appHash: string
  resetAt: number
}

export interface UpdateEnumerationLimitStatus {
  limited: boolean
  resetAt?: number
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

async function hashValue(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

function getEnvValue(c: Context, key: string) {
  const env = c.env as Record<string, unknown> | undefined
  const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const value = env?.[key] ?? runtimeProcess?.env?.[key]
  return typeof value === 'string' ? value : value == null ? undefined : String(value)
}

function getLimit(c: Context) {
  const parsed = Number.parseInt(getEnvValue(c, 'RATE_LIMIT_UPDATE_ENUMERATION_MISSES') ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT
}

function getSecret(c: Context) {
  return getEnvValue(c, 'RATE_LIMIT_UPDATE_ENUMERATION_HASH_SECRET') ?? getEnvValue(c, 'CODEPUSHGO_API_KEY') ?? 'codepushgo-update-enumeration'
}

function cacheRequest(ipHash: string, slot: number) {
  return new Request(`https://rate-limit.codepushgo.local${UPDATE_ENUMERATION_PATH}/${slot}?ip=${encodeURIComponent(ipHash)}`)
}

async function readSlot(cache: Cache | undefined, request: Request): Promise<EnumerationSlotData | null> {
  try {
    const response = await cache?.match(request)
    if (!response)
      return null
    const data = await response.json() as EnumerationSlotData
    if (data.resetAt <= Date.now())
      return null
    return data
  }
  catch {
    return null
  }
}

async function readSlots(c: Context) {
  const ip = getClientIP(c)
  const ipHash = await hashValue(`${getSecret(c)}:ip:${ip}`)
  const cache = await globalThis.caches?.open(CACHE_NAME)
  const slots = await Promise.all(Array.from({ length: SLOT_COUNT }, async (_, slot) => {
    const request = cacheRequest(ipHash, slot)
    return { request, slot, data: await readSlot(cache, request) }
  }))
  return { cache, ip, ipHash, slots }
}

export async function isUpdateEnumerationLimited(c: Context): Promise<UpdateEnumerationLimitStatus> {
  const { ip, slots } = await readSlots(c)
  if (ip === 'unknown')
    return { limited: false }
  const distinctCount = new Set(slots.map(slot => slot.data?.appHash).filter(Boolean)).size
  const resetAt = slots.find(slot => slot.data?.resetAt)?.data?.resetAt
  return { limited: distinctCount >= getLimit(c), resetAt }
}

export async function recordUpdateEnumerationMiss(c: Context, appId: string): Promise<UpdateEnumerationLimitStatus> {
  const { cache, ip, slots } = await readSlots(c)
  if (ip === 'unknown' || !cache)
    return { limited: false }

  const existingHashes = slots.map(slot => slot.data?.appHash).filter(Boolean)
  const currentResetAt = slots.find(slot => slot.data?.resetAt)?.data?.resetAt
  if (new Set(existingHashes).size >= getLimit(c))
    return { limited: true, resetAt: currentResetAt }

  const appHash = await hashValue(`${getSecret(c)}:app:${appId.trim().toLowerCase()}`)
  const existing = slots.find(slot => slot.data?.appHash === appHash)
  if (existing)
    return { limited: false, resetAt: existing.data?.resetAt }

  const resetAt = Date.now() + TTL_SECONDS * 1000
  const target = slots.find(slot => !slot.data) ?? slots[0]
  await cache.put(target.request, new Response(JSON.stringify({ appHash, resetAt }), {
    headers: {
      'cache-control': `max-age=${TTL_SECONDS}`,
      'content-type': 'application/json',
    },
  }))

  const distinctCount = new Set([...existingHashes, appHash]).size
  return { limited: distinctCount >= getLimit(c), resetAt }
}

export function updateEnumerationLimitedResponse(c: Context) {
  return c.json({ error: 'on_premise_app', message: 'App was not found' }, 429)
}
