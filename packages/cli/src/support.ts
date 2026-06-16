import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const secretJsonKeys = ['access_token', 'refresh_token', 'token', 'p8', 'pem', 'private_key']

export interface SupportBundleInput {
  kind: string
  appId: string
  error: string
  logs?: string[]
  sections?: Array<{ title: string, lines: string[] }>
}

export function redactSecrets(input: string) {
  let output = input
  output = output.replace(/Authorization:\s*Bearer\s+[^\s"']+/gi, 'Authorization: Bearer [REDACTED]')
  output = output.replace(/\bcapg(?:key|_)\w+/gi, '[REDACTED]')
  output = output.replace(/capgkey=([^\s&]+)/gi, 'capgkey=[REDACTED]')
  output = output.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
  for (const key of secretJsonKeys) {
    const pattern = new RegExp(`("${key}"\\s*:\\s*")[^"]+(")`, 'gi')
    output = output.replace(pattern, '$1[REDACTED]$2')
  }
  return output
}

export function buildSupportMailto(input: { subject: string, body: string, attachmentPath?: string, uploadUrl?: string }) {
  const suffix = input.uploadUrl
    ? `\n\nLogs: ${input.uploadUrl}`
    : input.attachmentPath
      ? `\n\nPlease attach: ${input.attachmentPath}`
      : ''
  const body = `${input.body}${suffix}`
  return `mailto:support@codepushgo.com?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(body)}`
}

export const MAILTO_BODY_MAX = 1800
export const SUPPORT_BUNDLE_GZ_CAP = 10 * 1024 * 1024

export function buildMailtoUrl(input: { to: string, subject: string, body: string }) {
  const marker = '...(truncated)'
  const body = input.body.length > MAILTO_BODY_MAX
    ? `${input.body.slice(0, MAILTO_BODY_MAX - marker.length)}${marker}`
    : input.body
  return `mailto:${input.to}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(body)}`
}

export function buildHelpMenuOptions(input: { hasBuildLog: boolean }) {
  return [
    { value: 'support', label: 'Email support' },
    ...(input.hasBuildLog ? [{ value: 'ai', label: 'Analyze build log' }] : []),
    { value: 'retry', label: 'Retry' },
    { value: 'exit', label: 'Exit' },
  ]
}

let internalLogPath: string | null = null

export function getInternalLogPath() {
  return internalLogPath
}

export function startInternalLog(appId: string, dir: string) {
  mkdirSync(dir, { recursive: true })
  internalLogPath = join(dir, `${appId.replace(/[^a-z0-9.-]/gi, '_')}.log`)
  writeFileSync(internalLogPath, '')
  return internalLogPath
}

export function appendInternalLog(line: string) {
  if (!internalLogPath)
    return
  appendFileSync(internalLogPath, `${redactSecrets(line)}\n`)
}

export function safeHeaders(headers: Headers) {
  const allowed = ['date', 'x-request-id', 'x-ratelimit-remaining', 'content-type', 'www-authenticate']
  return allowed
    .map(key => headers.get(key) ? `${key}=${headers.get(key)}` : undefined)
    .filter((value): value is string => !!value)
    .join('; ')
}

export function renderSupportBundle(input: SupportBundleInput) {
  const lines = [
    `kind=${input.kind}`,
    `appId=${input.appId}`,
    `error=${redactSecrets(input.error)}`,
    '',
  ]

  for (const section of input.sections ?? []) {
    lines.push(`[${section.title}]`)
    lines.push(...section.lines.map(redactSecrets))
    lines.push('')
  }

  if (input.logs?.length) {
    lines.push('[Recent logs]')
    lines.push(...input.logs.map(redactSecrets))
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function renderBundleWithinGzCap(input: SupportBundleInput, cap = SUPPORT_BUNDLE_GZ_CAP, onPass?: () => void) {
  const buildSection = input.sections?.find(section => /build output/i.test(section.title))
  if (!buildSection)
    return gzipRendered(input, onPass)

  let low = 0
  let high = buildSection.lines.length
  let best = gzipRendered(input, onPass)
  while (low <= high) {
    const keep = Math.floor((low + high) / 2)
    const candidate = withBuildTail(input, keep)
    const rendered = gzipRendered(candidate, onPass)
    if (rendered.gz.length <= cap) {
      best = rendered
      low = keep + 1
    }
    else {
      high = keep - 1
    }
  }

  if (best.gz.length <= cap || best.rendered.includes('omitted to fit'))
    return best
  return gzipRendered(withBuildTail(input, 0), onPass)
}

export function writeSupportBundleFiles(input: SupportBundleInput, dir: string) {
  mkdirSync(dir, { recursive: true })
  const { rendered, gz } = renderBundleWithinGzCap(input)
  const base = `${input.kind}-${input.appId.replace(/[^a-z0-9.-]/gi, '_')}`
  const logPath = join(dir, `${base}.log`)
  const gzPath = `${logPath}.gz`
  writeFileSync(logPath, rendered)
  writeFileSync(gzPath, gz)
  return { logPath, gzPath }
}

function gzipRendered(input: SupportBundleInput, onPass?: () => void) {
  onPass?.()
  const rendered = renderSupportBundle(input)
  return { rendered, gz: gzipSync(rendered) }
}

function withBuildTail(input: SupportBundleInput, keep: number): SupportBundleInput {
  const sections = (input.sections ?? []).map((section) => {
    if (!/build output/i.test(section.title))
      return section
    const hidden = Math.max(0, section.lines.length - keep)
    const marker = hidden > 0 ? [`${hidden} build output lines omitted to fit the 10 MB support upload limit`] : []
    return { ...section, lines: [...marker, ...section.lines.slice(-keep)] }
  })
  return { ...input, sections }
}
