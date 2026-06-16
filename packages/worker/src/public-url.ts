export interface PublicUrlValidationMessages {
  invalidUrl: string
  publicHost: string
  ipLiteral: string
  https: string
  dnsResolution: string
  fetchFailed: string
  tooManyRedirects: string
}

export interface PublicUrlValidationOptions {
  messages: PublicUrlValidationMessages
  requireDnsResolution?: boolean
  fetchImpl?: typeof fetch
  maxRedirects?: number
}

const dnsOverHttpsUrl = 'https://cloudflare-dns.com/dns-query'
const privateHostnames = new Set(['localhost', 'localhost.localdomain'])

export function getPublicUrlSyntaxValidationError(value: string, options: Pick<PublicUrlValidationOptions, 'messages'>) {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    return options.messages.invalidUrl
  }

  if (url.protocol !== 'https:')
    return options.messages.https
  if (privateHostnames.has(url.hostname.toLowerCase()))
    return options.messages.publicHost
  if (isIpLiteral(url.hostname))
    return isPublicIpAddress(url.hostname) ? null : options.messages.ipLiteral
  return null
}

export async function getPublicHostnameValidationError(value: string, options: PublicUrlValidationOptions) {
  const syntaxError = getPublicUrlSyntaxValidationError(value, options)
  if (syntaxError)
    return syntaxError

  const url = new URL(value)
  const fetchImpl = options.fetchImpl ?? fetch
  const records = await resolveHostAddresses(url.hostname, fetchImpl)
  if (records.length === 0)
    return options.requireDnsResolution ? options.messages.dnsResolution : null
  return records.every(isPublicIpAddress) ? null : options.messages.publicHost
}

export async function fetchPublicUrl(value: string, init: RequestInit | undefined, options: PublicUrlValidationOptions): Promise<{ response: Response | null, error: string | null, finalUrl: string | null }> {
  const fetchImpl = options.fetchImpl ?? fetch
  let currentUrl = value
  const maxRedirects = options.maxRedirects ?? 5

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const validationError = await getPublicHostnameValidationError(currentUrl, { ...options, fetchImpl })
    if (validationError)
      return { response: null, error: validationError, finalUrl: null }

    let response: Response
    try {
      response = await fetchImpl(currentUrl, { ...init, redirect: 'manual' })
    }
    catch {
      return { response: null, error: options.messages.fetchFailed, finalUrl: null }
    }

    if (!isRedirectStatus(response.status))
      return { response, error: null, finalUrl: currentUrl }

    const location = response.headers.get('location')
    if (!location)
      return { response, error: null, finalUrl: currentUrl }
    currentUrl = new URL(location, currentUrl).toString()
  }

  return { response: null, error: options.messages.tooManyRedirects, finalUrl: null }
}

async function resolveHostAddresses(hostname: string, fetchImpl: typeof fetch) {
  const records: string[] = []
  for (const type of ['A', 'AAAA']) {
    const url = new URL(dnsOverHttpsUrl)
    url.searchParams.set('name', hostname)
    url.searchParams.set('type', type)
    const response = await fetchImpl(url.toString(), { headers: { accept: 'application/dns-json' } })
    if (!response.ok)
      continue
    const payload = await response.json().catch(() => null) as { Answer?: Array<{ data?: unknown }> } | null
    for (const answer of payload?.Answer ?? []) {
      if (typeof answer.data === 'string')
        records.push(answer.data)
    }
  }
  return records
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function isIpLiteral(hostname: string) {
  return isIPv4(hostname) || isIPv6(hostname)
}

function isIPv4(value: string) {
  const parts = value.split('.')
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

function isIPv6(value: string) {
  return value.includes(':')
}

function isPublicIpAddress(value: string) {
  if (isIPv4(value))
    return isPublicIPv4(value)
  if (isIPv6(value))
    return isPublicIPv6(value)
  return false
}

function isPublicIPv4(value: string) {
  const [a, b] = value.split('.').map(Number)
  if (a === 10 || a === 127 || a === 0)
    return false
  if (a === 169 && b === 254)
    return false
  if (a === 172 && b >= 16 && b <= 31)
    return false
  if (a === 192 && b === 168)
    return false
  if (a === 100 && b >= 64 && b <= 127)
    return false
  if (a >= 224)
    return false
  return true
}

function isPublicIPv6(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === '::1' || normalized === '::')
    return false
  if (normalized.startsWith('fc') || normalized.startsWith('fd'))
    return false
  if (normalized.startsWith('fe80:'))
    return false
  return true
}
