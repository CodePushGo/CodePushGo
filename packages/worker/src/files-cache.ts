export async function matchDefaultCache(request: Request): Promise<Response | undefined> {
  const defaultCache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default
  const cached = await defaultCache?.match(request)
  return cached ? cloneCachedResponse(cached) : undefined
}

function cloneCachedResponse(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('X-CodePushGo-Cache', 'hit')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
