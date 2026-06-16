const previewHostnameRegex = /^([^.]+)\.preview(?:\.[^.]+)?\.(?:codepushgo\.app)$/
const previewSeparator = '-'
const previewChannelPrefix = 'c'
const dnsLabelMaxLength = 63

export interface ParsedBundlePreviewSubdomain {
  appId: string
  versionId: number
}

export interface ParsedChannelPreviewSubdomain {
  appId: string
  channelId: number
}

export type ParsedPreviewSubdomain = ParsedBundlePreviewSubdomain | ParsedChannelPreviewSubdomain

function isLowercaseAlphaNumeric(char: string) {
  return /^[a-z0-9]$/.test(char)
}

function isDirectPreviewCharacter(char: string) {
  return isLowercaseAlphaNumeric(char) || char === '_'
}

function encodeEscapedByte(char: string) {
  if (char === '.')
    return '-0'
  if (char === '-')
    return '-1'
  if (/^[A-Z]$/.test(char))
    return `-${char.toLowerCase()}`
  throw new Error(`Unsupported preview app id character: ${char}`)
}

function assertValidPreviewVersionId(versionId: number) {
  if (!Number.isSafeInteger(versionId) || versionId < 0)
    throw new Error(`Invalid preview version id: ${versionId}`)
}

function assertValidPreviewChannelId(channelId: number) {
  if (!Number.isSafeInteger(channelId) || channelId <= 0)
    throw new Error(`Invalid preview channel id: ${channelId}`)
}

export function encodePreviewAppId(appId: string) {
  return Array.from(appId).map(char => isDirectPreviewCharacter(char) ? char : encodeEscapedByte(char)).join('')
}

function buildEncodedPreviewSubdomain(target: string, appId: string) {
  const label = `${target}${previewSeparator}${encodePreviewAppId(appId)}`
  if (label.length > dnsLabelMaxLength)
    throw new Error(`Preview subdomain exceeds DNS label limit: "${label}" (${label.length} characters)`)
  return label
}

export function buildPreviewSubdomain(appId: string, versionId: number) {
  assertValidPreviewVersionId(versionId)
  return buildEncodedPreviewSubdomain(String(versionId), appId)
}

export function buildChannelPreviewSubdomain(appId: string, channelId: number) {
  assertValidPreviewChannelId(channelId)
  return buildEncodedPreviewSubdomain(`${previewChannelPrefix}${channelId}`, appId)
}

export function decodePreviewAppId(encodedAppId: string) {
  let decoded = ''
  for (let index = 0; index < encodedAppId.length; index += 1) {
    const char = encodedAppId[index]
    if (char !== '-') {
      if (!isDirectPreviewCharacter(char!))
        return null
      decoded += char
      continue
    }

    const escapedByte = encodedAppId[index + 1]
    if (!escapedByte)
      return null
    if (escapedByte === '0') {
      decoded += '.'
      index += 1
      continue
    }
    if (escapedByte === '1') {
      decoded += '-'
      index += 1
      continue
    }
    if (/^[a-z]$/.test(escapedByte)) {
      decoded += escapedByte.toUpperCase()
      index += 1
      continue
    }
    return null
  }
  return decoded
}

function parseVersionId(value: string) {
  if (!/^\d+$/.test(value))
    return null
  const versionId = Number.parseInt(value, 10)
  return Number.isSafeInteger(versionId) ? versionId : null
}

function parseChannelId(value: string) {
  const channelId = parseVersionId(value)
  return channelId === null || channelId <= 0 ? null : channelId
}

function parseEncodedPreviewSubdomain(subdomain: string): ParsedPreviewSubdomain | null {
  const separatorIndex = subdomain.indexOf(previewSeparator)
  if (separatorIndex <= 0)
    return null

  const target = subdomain.slice(0, separatorIndex)
  const appId = decodePreviewAppId(subdomain.slice(separatorIndex + previewSeparator.length))
  if (!appId)
    return null

  if (target.startsWith(previewChannelPrefix)) {
    const channelId = parseChannelId(target.slice(previewChannelPrefix.length))
    return channelId === null ? null : { appId, channelId }
  }

  const versionId = parseVersionId(target)
  return versionId === null ? null : { appId, versionId }
}

function parseLegacyPreviewSubdomain(subdomain: string): ParsedPreviewSubdomain | null {
  const separatorIndex = subdomain.lastIndexOf('-')
  if (separatorIndex <= 0)
    return null

  const versionId = parseVersionId(subdomain.slice(separatorIndex + 1))
  if (versionId === null)
    return null

  return {
    appId: subdomain.slice(0, separatorIndex).replaceAll('__', '.'),
    versionId,
  }
}

export function parsePreviewSubdomain(subdomain: string): ParsedPreviewSubdomain | null {
  return parseEncodedPreviewSubdomain(subdomain) ?? parseLegacyPreviewSubdomain(subdomain)
}

export function parsePreviewHostname(hostname: string): ParsedPreviewSubdomain | null {
  const match = hostname.match(previewHostnameRegex)
  return match?.[1] ? parsePreviewSubdomain(match[1]) : null
}
