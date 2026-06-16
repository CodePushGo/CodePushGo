export interface LocalReadProxyDeps {
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>
  fetchImpl?: typeof fetch
}

const READ_PREFIX = '/read/attachments/'

export function getAttachmentPathFromReadUrl(url: string | URL) {
  const rawUrl = String(url)
  const parsed = typeof url === 'string' ? new URL(url) : url
  const rawPath = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl.slice(rawUrl.indexOf('/', rawUrl.indexOf('://') + 3)).split(/[?#]/, 1)[0] ?? ''
    : parsed.pathname
  if (!rawPath.startsWith(READ_PREFIX) || /(?:^|\/)(?:\.|%2e)(?:\.|%2e)?(?:\/|$)/i.test(rawPath))
    return undefined

  const path = decodeURIComponent(rawPath.slice(READ_PREFIX.length))
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(segment => segment === '.' || segment === '..'))
    return undefined
  return path
}

export async function proxyLocalAttachmentRead(request: Request, deps: LocalReadProxyDeps): Promise<Response | undefined> {
  const attachmentPath = getAttachmentPathFromReadUrl(request.url)
  if (!attachmentPath)
    return undefined

  const signedUrl = await deps.createSignedUrl(attachmentPath, 60)
  const fetchImpl = deps.fetchImpl ?? fetch
  const upstream = await fetchImpl(signedUrl, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
  })
  return localReadProxyResponse(upstream, attachmentPath, request.method)
}

export function localReadProxyResponse(upstream: Response, attachmentPath: string, method: string) {
  const headers = new Headers(upstream.headers)
  const cacheControl = headers.get('cache-control')
  if (cacheControl && !cacheControl.toLowerCase().split(',').map(part => part.trim()).includes('no-transform'))
    headers.set('cache-control', `${cacheControl}, no-transform`)
  headers.set('content-disposition', `attachment; filename="${attachmentPath}"`)

  return new Response(method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}
