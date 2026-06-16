const bundlePreviewCacheControl = 'public, max-age=31536000, immutable'
const channelPreviewCacheControl = 'no-store, no-cache, must-revalidate, max-age=0'

export interface PreviewDownloadBundle {
  checksum: string | null
  external_url?: string | null
  externalUrl?: string | null
  id: number
  manifest_count?: number | null
  manifestCount?: number | null
  name?: string | null
  r2_path?: string | null
  path?: string | null
  session_key?: string | null
  sessionKey?: string | null
}

export interface PreviewDownloadPayload {
  appId: string
  checksum?: string
  sessionKey?: string
  url: string
  version: string
}

export function buildPreviewResponseHeaders(contentType: string, options: { disableCache?: boolean, httpEtag?: string } = {}) {
  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('X-Content-Type-Options', 'nosniff')

  if (options.disableCache) {
    headers.set('Cache-Control', channelPreviewCacheControl)
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')
    return headers
  }

  headers.set('Cache-Control', bundlePreviewCacheControl)
  if (options.httpEtag)
    headers.set('etag', options.httpEtag)
  return headers
}

export function buildPreviewPayloadResponseHeaders() {
  const headers = buildPreviewResponseHeaders('application/json', { disableCache: true })
  headers.set('Access-Control-Allow-Origin', '*')
  return headers
}

export async function buildPreviewDownloadPayload(_context: unknown, appId: string, bundle: PreviewDownloadBundle): Promise<PreviewDownloadPayload> {
  const url = bundle.external_url ?? bundle.externalUrl
  if (!url)
    throw new Error('Bundle download URL is not available')

  return {
    appId,
    checksum: bundle.checksum ?? undefined,
    sessionKey: bundle.session_key ?? bundle.sessionKey ?? undefined,
    url,
    version: bundle.name || `preview-${bundle.id}`,
  }
}
