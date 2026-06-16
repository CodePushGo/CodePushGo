import type { Context } from 'hono'
import type { Env } from './storage'
import { cloudlog, cloudlogErr, serializeError } from './logging'

const posthogCaptureUrl = 'https://eu.i.posthog.com/capture/'
const posthogExceptionUrl = 'https://eu.i.posthog.com/i/v0/e/'

export type PostHogGroups = Record<string, string>

export interface PostHogCapturePayload {
  event: string
  channel?: string
  description?: string
  distinct_id?: string
  groups?: PostHogGroups
  ip?: string
  setPersonProperties?: boolean
  tags?: Record<string, unknown>
  timestamp?: string
  user_id?: string
}

interface PostHogContextEnv {
  env?: Env
  get?: (key: string) => unknown
  req?: { method: string, url: string }
}

export async function trackPosthogEvent(c: Context | PostHogContextEnv, payload: PostHogCapturePayload) {
  const apiKey = getEnv(c, 'POSTHOG_API_KEY')
  if (!apiKey) {
    cloudlog({ requestId: getRequestId(c), message: 'PostHog not configured' })
    return false
  }

  const host = getEnv(c, 'POSTHOG_API_HOST') || posthogCaptureUrl
  const posthogUrl = host.endsWith('/capture/') ? host : new URL('capture/', host.endsWith('/') ? host : `${host}/`).toString()
  const distinctId = payload.user_id || payload.distinct_id || 'anonymous'
  const properties: Record<string, unknown> = {
    channel: payload.channel,
    description: payload.description,
  }
  if (payload.tags)
    Object.assign(properties, payload.tags)
  if (payload.setPersonProperties !== false)
    properties.$set = payload.tags
  if (payload.groups && Object.keys(payload.groups).length > 0)
    properties.$groups = payload.groups

  try {
    const res = await fetch(posthogUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: payload.event,
        distinct_id: distinctId,
        properties,
        ip: payload.ip,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      }),
    })
    if (!res.ok) {
      cloudlogErr({ requestId: getRequestId(c), message: 'PostHog error', status: res.status, error: await res.text(), event: payload.event, distinctId })
      return false
    }
    cloudlog({ requestId: getRequestId(c), message: 'PostHog event sent', event: payload.event, distinctId })
    return true
  }
  catch (error) {
    cloudlogErr({ requestId: getRequestId(c), message: 'PostHog fetch failed', error: serializeError(error), event: payload.event, distinctId })
    return false
  }
}

export async function capturePosthogException(c: Context | PostHogContextEnv, payload: {
  error: unknown
  functionName: string
  kind: 'drizzle_error' | 'http_exception' | 'unhandled_error'
  status?: number
}) {
  const apiKey = getEnv(c, 'POSTHOG_API_KEY')
  if (!apiKey) {
    cloudlog({ requestId: getRequestId(c), message: 'PostHog not configured' })
    return false
  }

  const host = getEnv(c, 'POSTHOG_API_HOST') || posthogExceptionUrl
  let posthogUrl: string
  try {
    posthogUrl = getPostHogExceptionUrl(host)
  }
  catch (error) {
    cloudlogErr({ requestId: getRequestId(c), message: 'Invalid PostHog host', error: serializeError(error), host })
    return false
  }

  const serializedError = serializeError(payload.error)
  const distinctId = `backend:${getEnv(c, 'ENV_NAME') || 'unknown'}:${payload.functionName}`
  const frames = parseExceptionFrames(serializedError.stack, payload.functionName)
  const topFrame = frames[0]
  const fingerprint = [
    distinctId,
    payload.kind,
    serializedError.name || 'Error',
    topFrame?.function || payload.functionName,
    topFrame?.filename || 'unknown',
    String(payload.status ?? 500),
  ].join(':')

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    let res: Response
    try {
      res = await fetch(posthogUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: apiKey,
          event: '$exception',
          properties: {
            distinct_id: distinctId,
            $exception_list: [{
              type: serializedError.name || 'Error',
              value: serializedError.message,
              mechanism: { handled: true, synthetic: false },
              stacktrace: { type: 'raw', frames },
            }],
            $exception_fingerprint: fingerprint,
            error_kind: payload.kind,
            function_name: payload.functionName,
            method: getRequestMethod(c),
            request_id: getRequestId(c),
            status: payload.status,
            url_path: getRequestPath(getRequestUrl(c)),
          },
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    }
    catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
    if (!res.ok) {
      cloudlogErr({ requestId: getRequestId(c), message: 'PostHog exception error', status: res.status, error: await res.text(), event: '$exception', distinctId })
      return false
    }
    cloudlog({ requestId: getRequestId(c), message: 'PostHog exception sent', event: '$exception', distinctId })
    return true
  }
  catch (error) {
    cloudlogErr({ requestId: getRequestId(c), message: 'PostHog exception fetch failed', error: serializeError(error), event: '$exception', distinctId })
    return false
  }
}

function getEnv(c: Context | PostHogContextEnv, key: keyof Env) {
  return 'env' in c ? c.env?.[key] : undefined
}

function getRequestId(c: Context | PostHogContextEnv) {
  return typeof c.get === 'function' ? c.get('requestId') : undefined
}

function getRequestMethod(c: Context | PostHogContextEnv) {
  return c.req?.method ?? 'GET'
}

function getRequestUrl(c: Context | PostHogContextEnv) {
  return c.req?.url ?? 'https://local/'
}

function getPostHogExceptionUrl(host: string) {
  const trimmedHost = host.replace(/\/+$/g, '')
  if (trimmedHost.endsWith('/i/v0/e'))
    return `${trimmedHost}/`
  const normalizedHost = trimmedHost.replace(/\/capture$/g, '/')
  return new URL('i/v0/e/', normalizedHost.endsWith('/') ? normalizedHost : `${normalizedHost}/`).toString()
}

function getRequestPath(url: string) {
  try {
    return new URL(url).pathname || '/'
  }
  catch {
    return '/'
  }
}

function parseExceptionFrames(stack: string | undefined, fallbackFunctionName: string) {
  const frames = stack?.split('\n').slice(1).map((line) => {
    const trimmed = line.trim()
    const withoutAt = trimmed.startsWith('at ') ? trimmed.slice(3) : trimmed
    let functionName = fallbackFunctionName
    let location = withoutAt
    const groupedLocationIndex = withoutAt.lastIndexOf(' (')
    if (groupedLocationIndex !== -1 && withoutAt.endsWith(')')) {
      functionName = withoutAt.slice(0, groupedLocationIndex).trim() || fallbackFunctionName
      location = withoutAt.slice(groupedLocationIndex + 2, -1)
    }
    const lastColonIndex = location.lastIndexOf(':')
    const secondLastColonIndex = lastColonIndex === -1 ? -1 : location.lastIndexOf(':', lastColonIndex - 1)
    if (lastColonIndex === -1 || secondLastColonIndex === -1)
      return { function: fallbackFunctionName, platform: 'custom', lang: 'javascript' }
    return {
      function: functionName,
      filename: location.slice(0, secondLastColonIndex),
      lineno: Number.parseInt(location.slice(secondLastColonIndex + 1, lastColonIndex), 10),
      colno: Number.parseInt(location.slice(lastColonIndex + 1), 10),
      platform: 'custom',
      lang: 'javascript',
    }
  }).filter(Boolean)

  return frames && frames.length > 0 ? frames : [{ function: fallbackFunctionName, platform: 'custom', lang: 'javascript' }]
}
