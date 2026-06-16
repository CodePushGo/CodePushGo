import { describe, expect, it } from 'vitest'
import { buildRangeResponseHeaders, calculateBytesTransferred, shouldTrackBandwidth } from '../src/files-bandwidth'
import { testApp } from './helpers'

describe('[Capgo parity] files bandwidth tracking', () => {
  it('calculates full object bytes when Cloudflare returns an empty range shape', () => {
    expect(calculateBytesTransferred(3_478_395, { suffix: undefined })).toBe(3_478_395)
  })

  it('keeps range response headers finite when suffix is present but empty', () => {
    const headers = buildRangeResponseHeaders(3_478_395, { offset: 0, length: 100, suffix: undefined })
    expect(headers.get('content-range')).toBe('bytes 0-99/3478395')
    expect(headers.get('content-length')).toBe('100')
  })

  it('does not track bandwidth for cached HEAD reads', async () => {
    const originalCaches = globalThis.caches
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      writable: true,
      value: {
        default: {
          match: async () => new Response(null, {
            headers: {
              'cache-control': 'public, max-age=3600',
              'content-length': '3478395',
            },
          }),
        },
      },
    })
    try {
      const { app, env } = testApp()
      const response = await app.request('/read/attachments/orgs/test-org/apps/com.test.app/bundle.zip?device_id=device-1', { method: 'HEAD' }, env)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-length')).toBe('3478395')
      expect(shouldTrackBandwidth('HEAD', true)).toBe(false)
    }
    finally {
      Object.defineProperty(globalThis, 'caches', { configurable: true, writable: true, value: originalCaches })
    }
  })
})
