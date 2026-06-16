const consoleOrigin = 'https://console.codepushgo.com'
const assetPrefix = '/register-assets/'

function rewriteToConsole(request: Request) {
  const incoming = new URL(request.url)
  const pathname = incoming.pathname.startsWith(assetPrefix)
    ? `/assets/${incoming.pathname.slice(assetPrefix.length)}`
    : incoming.pathname
  const target = new URL(pathname + incoming.search, consoleOrigin)
  return new Request(target, request)
}

function rewriteAssetUrls(html: string) {
  return html
    .replaceAll('src="/assets/', `src="${assetPrefix}`)
    .replaceAll('href="/assets/', `href="${assetPrefix}`)
}

export default {
  async fetch(request: Request) {
    const response = await fetch(rewriteToConsole(request))
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html'))
      return response

    const headers = new Headers(response.headers)
    headers.delete('content-length')
    return new Response(rewriteAssetUrls(await response.text()), {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}
