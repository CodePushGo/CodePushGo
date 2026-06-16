import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

function createContext(env: Record<string, string> = {}) {
  return {
    env: {
      POSTHOG_API_KEY: 'posthog-key',
      POSTHOG_API_HOST: 'https://eu.i.posthog.com',
      ENV_NAME: 'prod',
      ...env,
    },
    get: (key: string) => key === 'requestId' ? 'request-id' : undefined,
    req: {
      method: 'POST',
      url: 'https://example.com/functions/v1/app',
    },
  }
}

beforeEach(() => {
  fetchMock.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('') })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

describe('[Capgo parity] posthog helper', () => {
  it('keeps person property updates enabled for normal PostHog events', async () => {
    const { trackPosthogEvent } = await import('../src/posthog')

    await trackPosthogEvent(createContext(), {
      event: 'Tracked Event',
      channel: 'usage',
      description: 'tracked',
      user_id: 'user-id',
      tags: { app_id: 'app-id' },
    })

    const request = fetchMock.mock.calls[0]
    const body = JSON.parse(request?.[1]?.body as string)

    expect(body.distinct_id).toBe('user-id')
    expect(body.properties.$set).toEqual({ app_id: 'app-id' })
  })

  it('can send historical events without updating person properties', async () => {
    const { trackPosthogEvent } = await import('../src/posthog')

    await trackPosthogEvent(createContext(), {
      event: 'Historical Event',
      channel: 'usage',
      description: 'tracked',
      setPersonProperties: false,
      tags: { source_record_id: '123' },
      timestamp: '2026-03-01T00:00:00.000Z',
      user_id: 'org-id',
    })

    const request = fetchMock.mock.calls[0]
    const body = JSON.parse(request?.[1]?.body as string)

    expect(body.timestamp).toBe('2026-03-01T00:00:00.000Z')
    expect(body.properties.source_record_id).toBe('123')
    expect(body.properties).not.toHaveProperty('$set')
  })

  it('uses the full exception endpoint host and only sends the request path for exceptions', async () => {
    const { capturePosthogException } = await import('../src/posthog')

    await capturePosthogException(createContext({ POSTHOG_API_HOST: 'https://eu.i.posthog.com/i/v0/e' }), {
      error: new Error('boom'),
      functionName: 'app',
      kind: 'unhandled_error',
      status: 500,
    })

    const request = fetchMock.mock.calls[0]
    const url = request?.[0]
    const body = JSON.parse(request?.[1]?.body as string)

    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/')
    expect(body.event).toBe('$exception')
    expect(body.token).toBe('posthog-key')
    expect(body.properties.distinct_id).toBe('backend:prod:app')
    expect(body.properties.request_id).toBe('request-id')
    expect(body.properties.url_path).toBe('/functions/v1/app')
    expect(body.properties).not.toHaveProperty('url')
    expect(body.properties).not.toHaveProperty('$set')
    expect(body.properties.$exception_fingerprint).toContain('backend:prod:app')
    expect(body.properties.$exception_list[0].type).toBe('Error')
    expect(body.properties.$exception_list[0].value).toBe('boom')
    expect(body.properties.$exception_list[0].stacktrace.frames[0].platform).toBe('custom')
    expect(request?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('logs and skips exception delivery when the configured PostHog host is invalid', async () => {
    const { capturePosthogException } = await import('../src/posthog')

    const sent = await capturePosthogException(createContext({ POSTHOG_API_HOST: '://bad-host' }), {
      error: new Error('boom'),
      functionName: 'app',
      kind: 'unhandled_error',
      status: 500,
    })

    expect(sent).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Invalid PostHog host',
      host: '://bad-host',
    }))
  })
})
