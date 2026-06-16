export type PreviewLink = ChannelPreviewLink | BundlePreviewLink

export interface ChannelPreviewLink {
  type: 'channel'
  appId: string
  channelId: number
  channelName: string
  payloadUrl?: string
}

export interface BundlePreviewLink {
  type: 'bundle'
  appId: string
  versionId: number
  payloadUrl?: string
}

export interface BuildChannelPreviewDeepLinkInput {
  appId: string
  channelId: number
  channelName: string
  payloadUrl?: string
  origin?: string
}

export interface BuildBundlePreviewDeepLinkInput {
  appId: string
  versionId: number
  payloadUrl?: string
  origin?: string
}

const nativeScheme = 'codepushgo'
const trustedHttpsHosts = new Set(['web.codepushgo.app', 'codepushgo.app'])
const trustedLocalHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export function buildChannelPreviewDeepLink(input: BuildChannelPreviewDeepLinkInput) {
  const url = createPreviewUrl('/preview/channel', input.origin)
  url.searchParams.set('appId', input.appId)
  url.searchParams.set('channel', input.channelName)
  url.searchParams.set('channelId', String(input.channelId))
  if (input.payloadUrl)
    url.searchParams.set('url', input.payloadUrl)
  return formatPreviewUrl(url, input.origin)
}

export function buildBundlePreviewDeepLink(input: BuildBundlePreviewDeepLinkInput) {
  const url = createPreviewUrl('/preview/bundle', input.origin)
  url.searchParams.set('appId', input.appId)
  url.searchParams.set('versionId', String(input.versionId))
  if (input.payloadUrl)
    url.searchParams.set('url', input.payloadUrl)
  return formatPreviewUrl(url, input.origin)
}

export function parsePreviewDeepLink(rawUrl: string): PreviewLink | null {
  return parseChannelPreviewDeepLink(rawUrl) ?? parseBundlePreviewDeepLink(rawUrl)
}

export function parseChannelPreviewDeepLink(rawUrl: string): ChannelPreviewLink | null {
  const url = parseTrustedPreviewUrl(rawUrl)
  if (!url || url.pathname !== '/preview/channel')
    return null

  const appId = url.searchParams.get('appId')
  const channelName = url.searchParams.get('channel')
  const channelId = parsePositiveSafeInteger(url.searchParams.get('channelId'))
  if (!appId || !channelName || channelId === null)
    return null

  return {
    type: 'channel',
    appId,
    channelId,
    channelName,
    payloadUrl: url.searchParams.get('url') ?? undefined,
  }
}

export function buildChannelPreviewLatestOptions(previewLink: ChannelPreviewLink) {
  return {
    appId: previewLink.appId,
    channel: previewLink.channelName,
    preview: true,
  }
}

function parseBundlePreviewDeepLink(rawUrl: string): BundlePreviewLink | null {
  const url = parseTrustedPreviewUrl(rawUrl)
  if (!url || url.pathname !== '/preview/bundle')
    return null

  const appId = url.searchParams.get('appId')
  const versionId = parsePositiveSafeInteger(url.searchParams.get('versionId'))
  if (!appId || versionId === null)
    return null

  return {
    type: 'bundle',
    appId,
    versionId,
    payloadUrl: url.searchParams.get('url') ?? undefined,
  }
}

function createPreviewUrl(pathname: string, origin?: string) {
  const base = origin ?? `${nativeScheme}://preview`
  const url = new URL(base)
  url.pathname = pathname
  return url
}

function formatPreviewUrl(url: URL, origin?: string) {
  if (origin)
    return url.toString()
  return `${nativeScheme}://${url.pathname.replace(/^\//, '')}?${url.searchParams.toString()}`
}

function parseTrustedPreviewUrl(rawUrl: string) {
  const normalized = rawUrl.trim().replace(new RegExp(`^${nativeScheme}:/preview/`), `${nativeScheme}://preview/`)
  let url: URL
  try {
    url = new URL(normalized)
  }
  catch {
    return null
  }

  if (url.protocol === `${nativeScheme}:`) {
    if (url.hostname !== 'preview')
      return null
    url.pathname = `/preview${url.pathname}`
    return url
  }

  if (url.protocol === 'https:' && trustedHttpsHosts.has(url.hostname))
    return url
  if (url.protocol === 'http:' && trustedLocalHosts.has(url.hostname))
    return url
  return null
}

function parsePositiveSafeInteger(value: string | null) {
  if (!value || !/^\d+$/.test(value))
    return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    return null
  return parsed
}
