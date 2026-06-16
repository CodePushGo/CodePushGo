import type { Context } from 'hono'
import { cloudlog } from './logging'

const FAILED_AUTH_TTL = 60 * 15
const DEFAULT_FAILED_AUTH_LIMIT = 20
const FAILED_AUTH_PATH = '/rate-limit/failed-auth'
const FAILED_ACCOUNT_AUTH_PATH = '/rate-limit/failed-auth-account'

const PUBLIC_DEVICE_OP_LIMIT = 5
const PUBLIC_DEVICE_OP_TTL = 1
const PUBLIC_DEVICE_OP_PATH = '/rate-limit/public-device-op'
const PUBLIC_DEVICE_CHANNEL_PATH = '/rate-limit/public-device-channel'
const PUBLIC_DEVICE_CHANNEL_TTL = 60
interface RateLimitData {
  count: number
  resetAt?: number
}

export interface RateLimitStatus {
  limited: boolean
  resetAt?: number
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

async function hashIdentifier(identifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier))
  return bytesToHex(new Uint8Array(digest))
}

export function normalizeRateLimitAccountIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase()
}

async function getAccountRateLimitKey(identifier: string): Promise<string | null> {
  const normalized = normalizeRateLimitAccountIdentifier(identifier)
  if (!normalized)
    return null
  return hashIdentifier(normalized)
}

export function getClientIP(c: Context): string {
  return c.req.header('cf-connecting-ip')
    ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? c.req.header('x-real-ip')
    ?? 'unknown'
}

function getFailedAuthLimit(c: Context): number {
  const raw = c.env?.RATE_LIMIT_FAILED_AUTH
  const parsed = raw ? Number.parseInt(String(raw), 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FAILED_AUTH_LIMIT
}

function buildResetAt() {
  return Date.now() + FAILED_AUTH_TTL * 1000
}

function ttlSeconds(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}

function cacheRequest(path: string, params: Record<string, string>) {
  const url = new URL(`https://rate-limit.codepushgo.local${path}`)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return new Request(url.toString(), { method: 'GET' })
}

async function readRateLimitData(request: Request): Promise<RateLimitData | undefined> {
  try {
    const cache = await globalThis.caches?.open('codepushgo-rate-limit')
    const response = await cache?.match(request)
    if (!response)
      return undefined
    const data = await response.json() as RateLimitData
    if (data.resetAt && data.resetAt <= Date.now())
      return undefined
    return data
  }
  catch {
    return undefined
  }
}

async function writeRateLimitData(request: Request, data: RateLimitData, ttl: number): Promise<void> {
  try {
    const cache = await globalThis.caches?.open('codepushgo-rate-limit')
    await cache?.put(request, new Response(JSON.stringify(data), {
      headers: {
        'cache-control': `max-age=${ttl}`,
        'content-type': 'application/json',
      },
    }))
  }
  catch {}
}

export async function isIPRateLimited(c: Context): Promise<RateLimitStatus> {
  const ip = getClientIP(c)
  if (ip === 'unknown') {
    cloudlog({ requestId: c.get('requestId'), message: 'Rate limit check skipped: unknown IP' })
    return { limited: false }
  }
  const data = await readRateLimitData(cacheRequest(FAILED_AUTH_PATH, { ip }))
  if (!data)
    return { limited: false }
  const limited = data.count >= getFailedAuthLimit(c)
  return { limited, resetAt: data.resetAt }
}

export async function recordFailedAuth(c: Context): Promise<void> {
  const ip = getClientIP(c)
  if (ip === 'unknown')
    return
  const request = cacheRequest(FAILED_AUTH_PATH, { ip })
  const existing = await readRateLimitData(request)
  const resetAt = buildResetAt()
  await writeRateLimitData(request, { count: (existing?.count ?? 0) + 1, resetAt }, ttlSeconds(resetAt))
}

export async function clearFailedAuth(c: Context): Promise<void> {
  const ip = getClientIP(c)
  if (ip === 'unknown')
    return
  await writeRateLimitData(cacheRequest(FAILED_AUTH_PATH, { ip }), { count: 0 }, 60)
}

export async function isAccountRateLimited(c: Context, accountIdentifier: string): Promise<RateLimitStatus> {
  const account = await getAccountRateLimitKey(accountIdentifier)
  if (!account) {
    cloudlog({ requestId: c.get('requestId'), message: 'Account rate limit check skipped: empty account identifier' })
    return { limited: false }
  }
  const data = await readRateLimitData(cacheRequest(FAILED_ACCOUNT_AUTH_PATH, { account }))
  if (!data)
    return { limited: false }
  const limited = data.count >= getFailedAuthLimit(c)
  return { limited, resetAt: data.resetAt }
}

export async function recordFailedAccountAuth(c: Context, accountIdentifier: string): Promise<void> {
  const account = await getAccountRateLimitKey(accountIdentifier)
  if (!account)
    return
  const request = cacheRequest(FAILED_ACCOUNT_AUTH_PATH, { account })
  const existing = await readRateLimitData(request)
  const resetAt = buildResetAt()
  await writeRateLimitData(request, { count: (existing?.count ?? 0) + 1, resetAt }, ttlSeconds(resetAt))
}

export async function clearFailedAccountAuth(c: Context, accountIdentifier: string): Promise<void> {
  const account = await getAccountRateLimitKey(accountIdentifier)
  if (!account)
    return
  await writeRateLimitData(cacheRequest(FAILED_ACCOUNT_AUTH_PATH, { account }), { count: 0 }, 60)
}

export interface PublicDeviceRateLimitInput {
  appId?: string
  deviceId?: string
  operation: string
  channel?: string
}

function normalizePublicRateLimitValue(value: string): string {
  return value.trim().toLowerCase()
}

async function incrementRateLimitWindow(request: Request, limit: number, ttl: number): Promise<RateLimitStatus> {
  const existing = await readRateLimitData(request)
  if (existing && existing.count >= limit)
    return { limited: true, resetAt: existing.resetAt }

  const resetAt = existing?.resetAt ?? Date.now() + ttl * 1000
  await writeRateLimitData(request, { count: (existing?.count ?? 0) + 1, resetAt }, ttlSeconds(resetAt))
  return { limited: false, resetAt }
}

export async function checkPublicDeviceRateLimit(input: PublicDeviceRateLimitInput): Promise<RateLimitStatus> {
  if (!input.appId || !input.deviceId)
    return { limited: false }

  const appId = normalizePublicRateLimitValue(input.appId)
  const deviceId = normalizePublicRateLimitValue(input.deviceId)
  const operation = normalizePublicRateLimitValue(input.operation)
  const opStatus = await incrementRateLimitWindow(
    cacheRequest(PUBLIC_DEVICE_OP_PATH, { appId, deviceId, operation }),
    PUBLIC_DEVICE_OP_LIMIT,
    PUBLIC_DEVICE_OP_TTL,
  )
  if (opStatus.limited)
    return opStatus

  if (!input.channel)
    return opStatus

  return incrementRateLimitWindow(
    cacheRequest(PUBLIC_DEVICE_CHANNEL_PATH, { appId, deviceId, channel: normalizePublicRateLimitValue(input.channel) }),
    1,
    PUBLIC_DEVICE_CHANNEL_TTL,
  )
}
