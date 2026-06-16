import { describe, expect, it, vi } from 'vitest'
import { getAttachmentPathFromReadUrl, proxyLocalAttachmentRead } from '../src/files-local-read-proxy'

describe('[Capgo parity] files local read proxy', () => {
  it('proxies local storage reads without requiring an app database lookup', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue('https://storage.example/object?token=test')
    const fetchImpl = vi.fn(async (input, init) => {
      expect(String(input)).toBe('https://storage.example/object?token=test')
      expect(init?.method).toBe('GET')
      expect(init?.headers).toBeUndefined()
      return new Response('proxied local bytes', {
        headers: {
          'cache-control': 'public, max-age=60',
          'content-disposition': 'inline; filename="stored.txt"',
          'content-type': 'text/plain',
        },
      })
    }) as typeof fetch

    const response = await proxyLocalAttachmentRead(
      new Request('http://localhost/read/attachments/orgs/test-org/apps/test-app/local.txt'),
      { createSignedUrl, fetchImpl },
    )

    expect(response?.status).toBe(200)
    expect(await response?.text()).toBe('proxied local bytes')
    expect(response?.headers.get('cache-control')).toBe('public, max-age=60, no-transform')
    expect(response?.headers.get('content-disposition')).toBe('attachment; filename="orgs/test-org/apps/test-app/local.txt"')
    expect(createSignedUrl).toHaveBeenCalledWith('orgs/test-org/apps/test-app/local.txt', 60)
  })

  it('preserves HEAD requests without downloading bytes from the signed URL proxy', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue('https://storage.example/object?token=test')
    const fetchImpl = vi.fn(async (_input, init) => {
      expect(init?.method).toBe('HEAD')
      expect(init?.headers).toBeUndefined()
      return new Response(null, {
        headers: {
          'cache-control': 'public, max-age=60',
          'content-disposition': 'inline; filename="stored.txt"',
          'content-type': 'text/plain',
        },
      })
    }) as typeof fetch

    const response = await proxyLocalAttachmentRead(
      new Request('http://localhost/read/attachments/orgs/test-org/apps/test-app/local.txt', { method: 'HEAD' }),
      { createSignedUrl, fetchImpl },
    )

    expect(response?.status).toBe(200)
    expect(await response?.text()).toBe('')
    expect(response?.headers.get('cache-control')).toBe('public, max-age=60, no-transform')
    expect(response?.headers.get('content-disposition')).toBe('attachment; filename="orgs/test-org/apps/test-app/local.txt"')
  })

  it('rejects invalid attachment read paths before proxying', () => {
    expect(getAttachmentPathFromReadUrl('http://localhost/read/attachments/orgs/test-org/apps/test-app/%2e%2e/secret.txt')).toBeUndefined()
    expect(getAttachmentPathFromReadUrl('http://localhost/read/attachments/')).toBeUndefined()
  })
})
