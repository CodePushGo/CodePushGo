import { describe, expect, it } from 'vitest'
import { trackEvent } from '../src/analytics/track'

describe('[Capgo parity] CLI analytics tracking', () => {
  it('sends v2 actor-scoped events without user_id', async () => {
    const previousFetch = globalThis.fetch
    const previousEndpoint = process.env.CODEPUSHGO_API_URL
    const requests: Array<{ url: string, authorization?: string, body: Record<string, unknown> }> = []

    try {
      process.env.CODEPUSHGO_API_URL = 'https://api.test/'
      globalThis.fetch = (async (input, init) => {
        requests.push({
          url: String(input),
          authorization: init?.headers instanceof Headers ? init.headers.get('authorization') ?? undefined : (init?.headers as Record<string, string> | undefined)?.authorization,
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
        })
        return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'content-type': 'application/json' } })
      }) as typeof fetch

      await trackEvent({
        apikey: 'test-key',
        channel: 'cli-usage',
        event: 'CLI Command Invoked',
        orgId: 'org-1',
        tags: { app_id: 'com.example.app', command_path: 'bundle upload' },
      })

      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({
        url: 'https://api.test/private/events',
        authorization: 'Bearer test-key',
      })
      expect(requests[0]?.body).toMatchObject({
        channel: 'cli-usage',
        event: 'CLI Command Invoked',
        notify: false,
        org_id: 'org-1',
        tracking_version: 2,
        tags: { app_id: 'com.example.app', command_path: 'bundle upload' },
      })
      expect(requests[0]?.body).not.toHaveProperty('user_id')
    }
    finally {
      globalThis.fetch = previousFetch
      if (previousEndpoint === undefined)
        delete process.env.CODEPUSHGO_API_URL
      else
        process.env.CODEPUSHGO_API_URL = previousEndpoint
    }
  })

  it('does not fail CLI flows when analytics delivery fails', async () => {
    const previousFetch = globalThis.fetch
    try {
      globalThis.fetch = (async () => {
        throw new Error('network down')
      }) as typeof fetch

      await expect(trackEvent({ apikey: 'test-key', channel: 'cli-usage', event: 'Best Effort' })).resolves.toBeUndefined()
    }
    finally {
      globalThis.fetch = previousFetch
    }
  })
})
