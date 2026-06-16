import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createOnError, type WorkerErrorContext } from '../src/on-error'

function createContext(request?: Request): WorkerErrorContext {
  return {
    get: (key: string) => key === 'requestId' ? 'request-id' : undefined,
    json: (body: unknown, status: number) => ({ body, status }),
    req: {
      method: request?.method ?? 'GET',
      raw: request ?? new Request('https://example.com/functions/v1/app', { method: 'GET' }),
      url: request?.url ?? 'https://example.com/functions/v1/app',
    },
  }
}

function httpError(status: number, cause: Record<string, unknown>) {
  return {
    status,
    cause,
    message: String(cause.message ?? 'HTTP error'),
  }
}

function createDeps() {
  return {
    backgroundTask: vi.fn((_c: WorkerErrorContext, promise: Promise<unknown>) => promise),
    capturePosthogException: vi.fn(async () => true),
    cloudlogErr: vi.fn(),
    sendDiscordAlert500: vi.fn(async () => true),
  }
}

describe('[Capgo parity] onError PostHog capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redacts sensitive JSON request body fields before Discord alerts', async () => {
    const deps = createDeps()
    const onError = createOnError('private', deps)
    const error = httpError(500, { error: 'internal_error', message: 'Something broke', moreInfo: {} })

    const response = await onError(error, createContext(new Request('https://example.com/functions/v1/private/accept_invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        captchaToken: 'captcha-secret',
        magic_invite_string: 'invite-secret',
        nested: { password: 'NestedPassword1!' },
        opt_for_newsletters: false,
        password: 'Password1!',
      }),
    })))

    expect(response).toMatchObject({ status: 500 })
    expect(deps.sendDiscordAlert500).toHaveBeenCalledOnce()
    const alertBody = deps.sendDiscordAlert500.mock.calls[0]?.[2]
    expect(alertBody).toBe(JSON.stringify({
      captchaToken: '[redacted]',
      magic_invite_string: '[redacted]',
      nested: { password: '[redacted]' },
      opt_for_newsletters: false,
      password: '[redacted]',
    }))
    expect(alertBody).not.toContain('captcha-secret')
    expect(alertBody).not.toContain('invite-secret')
    expect(alertBody).not.toContain('NestedPassword1!')
    expect(alertBody).not.toContain('Password1!')
  })

  it('captures backend HTTP exceptions in PostHog', async () => {
    const deps = createDeps()
    const onError = createOnError('app', deps)
    const error = httpError(500, { error: 'internal_error', message: 'Something broke', moreInfo: { trace: 'abc' } })

    const response = await onError(error, createContext())

    expect(deps.backgroundTask).toHaveBeenCalledTimes(2)
    expect(deps.sendDiscordAlert500).toHaveBeenCalledOnce()
    expect(deps.capturePosthogException).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ functionName: 'app', kind: 'http_exception', status: 500 }))
    expect(response).toEqual({ body: { error: 'internal_error', message: 'Something broke', moreInfo: { trace: 'abc' } }, status: 500 })
  })

  it('skips crash reporting for expected operational HTTP exceptions', async () => {
    const deps = createDeps()
    const onError = createOnError('api', deps)

    const response = await onError(httpError(503, { error: 'service_unavailable', message: 'Build service unavailable', moreInfo: {}, suppressDiscordAlert: true }), createContext())

    expect(deps.backgroundTask).not.toHaveBeenCalled()
    expect(deps.sendDiscordAlert500).not.toHaveBeenCalled()
    expect(deps.capturePosthogException).not.toHaveBeenCalled()
    expect(response).toEqual({ body: { error: 'service_unavailable', message: 'Build service unavailable', moreInfo: {} }, status: 503 })
  })

  it('skips PostHog capture for client HTTP exceptions', async () => {
    const deps = createDeps()
    const onError = createOnError('app', deps)

    const response = await onError(httpError(400, { error: 'bad_request', message: 'Invalid input', moreInfo: {} }), createContext())

    expect(deps.backgroundTask).not.toHaveBeenCalled()
    expect(deps.sendDiscordAlert500).not.toHaveBeenCalled()
    expect(deps.capturePosthogException).not.toHaveBeenCalled()
    expect(response).toEqual({ body: { error: 'bad_request', message: 'Invalid input', moreInfo: {} }, status: 400 })
  })

  it('captures Drizzle-style errors in PostHog', async () => {
    const deps = createDeps()
    const onError = createOnError('app', deps)

    const response = await onError({ cause: new Error('query failed'), message: 'db failed', name: 'DrizzleError' }, createContext())

    expect(deps.backgroundTask).toHaveBeenCalledTimes(2)
    expect(deps.sendDiscordAlert500).toHaveBeenCalledOnce()
    expect(deps.capturePosthogException).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ functionName: 'app', kind: 'drizzle_error', status: 500 }))
    expect(response).toEqual({ body: { error: 'unknown_error', message: 'Unknown error', moreInfo: {} }, status: 500 })
  })

  it('skips Discord for expected files Durable Object storage timeouts', async () => {
    const deps = createDeps()
    const onError = createOnError('files', deps)
    const error = Object.assign(new Error('Durable Object storage operation exceeded timeout which caused object to be reset.'), { durableObjectReset: true, overloaded: true })

    const response = await onError(error, createContext())

    expect(deps.backgroundTask).toHaveBeenCalledTimes(1)
    expect(deps.sendDiscordAlert500).not.toHaveBeenCalled()
    expect(deps.capturePosthogException).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ functionName: 'files', kind: 'unhandled_error', status: 500 }))
    expect(response).toEqual({ body: { error: 'unknown_error', message: 'Unknown error', moreInfo: {} }, status: 500 })
  })
})
