import { describe, expect, it } from 'vitest'
import { getDatabaseURL } from '../src/pg'

describe('[Capgo parity] getDatabaseURL header safety', () => {
  it.concurrent('does not try to mutate headers when response body was already consumed', async () => {
    const res = new Response('ok')
    await res.text()

    let headerCalls = 0
    const ctx = {
      res,
      env: {
        HYPERDRIVE_CAPGO_DIRECT_EU: { connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' },
        SUPABASE_DB_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
      },
      header: () => {
        headerCalls++
        throw new TypeError('This ReadableStream is disturbed (has already been read from), and cannot be used as a body.')
      },
      get: (key: string) => (key === 'requestId' ? 'test-request' : undefined),
      set: () => {},
    } as any

    expect(() => getDatabaseURL(ctx)).not.toThrow()
    expect(headerCalls).toBe(0)
  })

  it.concurrent('does not try to mutate headers when response body stream is locked', () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('ok'))
        controller.close()
      },
    })
    const res = new Response(stream)
    res.body?.getReader()

    let headerCalls = 0
    const ctx = {
      res,
      env: {
        HYPERDRIVE_CAPGO_DIRECT_EU: { connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' },
        SUPABASE_DB_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
      },
      header: () => {
        headerCalls++
        throw new TypeError('This ReadableStream is disturbed (has already been read from), and cannot be used as a body.')
      },
      get: (key: string) => (key === 'requestId' ? 'test-request' : undefined),
      set: () => {},
    } as any

    expect(() => getDatabaseURL(ctx)).not.toThrow()
    expect(headerCalls).toBe(0)
  })
})
