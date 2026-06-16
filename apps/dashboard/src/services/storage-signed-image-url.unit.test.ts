import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function mockSignFetch(urls: string[]) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
    const signed = urls.shift() ?? ''
    return new Response(JSON.stringify({ url: signed }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('createSignedImageUrl', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('extracts the storage path from signed image URLs before refreshing them', async () => {
    const fetchMock = mockSignFetch([
      'https://api.codepushgo.test/storage/v1/object/sign/images/org/org-1/logo/logo.png?token=fresh',
    ])

    const { createSignedImageUrl } = await import('./storage')
    const result = await createSignedImageUrl('https://api.codepushgo.test/storage/v1/object/sign/images/org/org-1/logo/logo.png?token=stale')

    expect(result).toBe('https://api.codepushgo.test/storage/v1/object/sign/images/org/org-1/logo/logo.png?token=fresh')
    expect(fetchMock).toHaveBeenCalledWith('/storage/sign?path=org%2Forg-1%2Flogo%2Flogo.png')
  })

  it('bypasses the cached signed URL when forceRefresh is requested', async () => {
    const fetchMock = mockSignFetch([
      'https://api.codepushgo.test/storage/v1/object/sign/images/org/org-2/logo/logo.png?token=initial',
      'https://api.codepushgo.test/storage/v1/object/sign/images/org/org-2/logo/logo.png?token=refreshed',
    ])

    const { createSignedImageUrl } = await import('./storage')
    const firstUrl = await createSignedImageUrl('org/org-2/logo/logo.png')
    const cachedUrl = await createSignedImageUrl('org/org-2/logo/logo.png')
    const refreshedUrl = await createSignedImageUrl(firstUrl, { forceRefresh: true })

    expect(firstUrl).toBe('https://api.codepushgo.test/storage/v1/object/sign/images/org/org-2/logo/logo.png?token=initial')
    expect(cachedUrl).toBe(firstUrl)
    expect(refreshedUrl).toBe('https://api.codepushgo.test/storage/v1/object/sign/images/org/org-2/logo/logo.png?token=refreshed')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('re-signs the image after the cache max age elapses', async () => {
    const fetchMock = mockSignFetch([
      'https://api.codepushgo.test/storage/v1/object/sign/images/org/org-3/logo/logo.png?token=initial',
      'https://api.codepushgo.test/storage/v1/object/sign/images/org/org-3/logo/logo.png?token=renewed',
    ])

    const { createSignedImageUrl } = await import('./storage')
    const firstUrl = await createSignedImageUrl('org/org-3/logo/logo.png')

    vi.advanceTimersByTime(15 * 60 * 1000 + 1)

    const renewedUrl = await createSignedImageUrl('org/org-3/logo/logo.png')

    expect(firstUrl).toBe('https://api.codepushgo.test/storage/v1/object/sign/images/org/org-3/logo/logo.png?token=initial')
    expect(renewedUrl).toBe('https://api.codepushgo.test/storage/v1/object/sign/images/org/org-3/logo/logo.png?token=renewed')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
