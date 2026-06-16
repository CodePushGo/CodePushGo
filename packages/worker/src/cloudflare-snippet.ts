const workerUrls = {
  EUROPE: 'https://plugin.eu.codepushgo.app',
  NORTH_AMERICA: 'https://plugin.na.codepushgo.app',
  SOUTH_AMERICA: 'https://plugin.sa.codepushgo.app',
}

const coloZones: Record<string, keyof typeof workerUrls> = {
  GRU: 'SOUTH_AMERICA',
  SFO: 'NORTH_AMERICA',
}

function matchesEndpoint(pathname: string, endpoint: string) {
  return pathname === endpoint || pathname.startsWith(`${endpoint}/`)
}

function getEndpointName(pathname: string) {
  if (matchesEndpoint(pathname, '/updates'))
    return 'updates'
  if (matchesEndpoint(pathname, '/stats'))
    return 'stats'
  if (matchesEndpoint(pathname, '/channel_self'))
    return 'channel_self'
  return 'unknown'
}

function isCacheableEndpoint(pathname: string) {
  return matchesEndpoint(pathname, '/updates') || matchesEndpoint(pathname, '/stats') || matchesEndpoint(pathname, '/channel_self')
}

function getOnPremCacheKey(hostname: string, appId: string, endpoint: string, method: string) {
  return `https://${hostname}/__internal__/onprem-cache-v2/${encodeURIComponent(appId)}/${endpoint}/${method}`
}

function getCacheTtlSeconds(headers: Headers) {
  const cacheControl = headers.get('Cache-Control') ?? headers.get('cache-control')
  if (!cacheControl)
    return null
  const directives = cacheControl.split(',').map(part => part.trim().toLowerCase())
  if (directives.includes('no-store'))
    return null
  const ttl = directives.find(part => part.startsWith('s-maxage=')) ?? directives.find(part => part.startsWith('max-age='))
  if (!ttl)
    return null
  const seconds = Number.parseInt(ttl.split('=')[1] ?? '', 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

async function extractAppId(request: Request, url: URL) {
  if ((request.method === 'DELETE' || request.method === 'GET') && matchesEndpoint(url.pathname, '/channel_self'))
    return url.searchParams.get('app_id')
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const body = await request.clone().json() as { app_id?: string }
      return body.app_id ?? null
    }
    catch {
      return null
    }
  }
  return null
}

function isOnPremResponse(status: number, body: unknown) {
  if (!body || typeof body !== 'object')
    return false
  const record = body as Record<string, unknown>
  return (status === 429 && record.error === 'on_premise_app') || record.isOnprem === true
}

function orderedWorkers(colo: string | undefined) {
  const primary = colo ? coloZones[colo] : undefined
  const order = primary ? [workerUrls[primary]] : [workerUrls.EUROPE]
  for (const url of [workerUrls.NORTH_AMERICA, workerUrls.EUROPE]) {
    if (!order.includes(url))
      order.push(url)
  }
  return order
}

async function parseJson(response: Response) {
  try {
    return await response.clone().json()
  }
  catch {
    return null
  }
}

async function cacheOnPrem(hostname: string, appId: string, endpoint: string, method: string, response: Response, body: unknown) {
  const ttl = getCacheTtlSeconds(response.headers)
  const defaultCache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default
  if (!ttl || !defaultCache)
    return
  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('X-Onprem-Cached', 'true')
  headers.set('X-Onprem-App-Id', appId)
  headers.set('X-Onprem-Ttl', String(ttl))
  await defaultCache.put(getOnPremCacheKey(hostname, appId, endpoint, method), new Response(JSON.stringify(body), {
    status: response.status,
    headers,
  }))
}

function buildWorkerRequest(request: Request, target: string) {
  const sourceUrl = new URL(request.url)
  const url = new URL(target)
  url.pathname = sourceUrl.pathname
  url.search = sourceUrl.search
  return new Request(url, request)
}

export const cloudflareSnippet = {
  async fetch(request: Request) {
    const url = new URL(request.url)
    const endpoint = getEndpointName(url.pathname)
    const appId = isCacheableEndpoint(url.pathname) ? await extractAppId(request, url) : null

    let firstOnPrem: { response: Response, body: unknown } | undefined
    const workers = orderedWorkers((request as Request & { cf?: { colo?: string } }).cf?.colo)
    for (const worker of workers) {
      try {
        const response = await fetch(buildWorkerRequest(request.clone() as Request, worker))
        const body = await parseJson(response)
        if (!isOnPremResponse(response.status, body))
          return response
        firstOnPrem ??= { response, body }
      }
      catch {
        return fetch(request)
      }
    }

    if (firstOnPrem && appId) {
      await cacheOnPrem(url.hostname, appId, endpoint, request.method, firstOnPrem.response, firstOnPrem.body)
      const headers = new Headers(firstOnPrem.response.headers)
      headers.set('Content-Type', 'application/json')
      headers.set('X-Onprem-Cached', 'false')
      headers.set('X-Onprem-App-Id', appId)
      return new Response(JSON.stringify(firstOnPrem.body), {
        status: firstOnPrem.response.status,
        headers,
      })
    }

    return firstOnPrem?.response ?? fetch(request)
  },
}
