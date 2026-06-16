export const CAPGO_API_VERSION_HEADER = 'capgo-api-version'
export const CAPGO_API_DEFAULT_VERSION = '2025-10-01'

export interface CapgoApiVersion {
  raw: string
  normalized: string
  major: number
  minor: number
  patch: number
  isDefault: boolean
  equals(version: string): boolean
  before(version: string): boolean
  atLeast(version: string): boolean
  handle<T>(handlers: Record<number, () => T>): T
}

function parseVersionValue(value: string) {
  const trimmed = value.trim().replace(/^v/i, '')
  const dateMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (dateMatch) {
    return {
      major: Number(dateMatch[1]),
      minor: Number(dateMatch[2]),
      patch: Number(dateMatch[3]),
    }
  }

  const semverMatch = trimmed.match(/^(\d+)(?:[.](\d+))?(?:[.](\d+))?$/)
  if (!semverMatch)
    return undefined

  return {
    major: Number(semverMatch[1]),
    minor: Number(semverMatch[2] ?? 0),
    patch: Number(semverMatch[3] ?? 0),
  }
}

function compareParts(a: Pick<CapgoApiVersion, 'major' | 'minor' | 'patch'>, b: Pick<CapgoApiVersion, 'major' | 'minor' | 'patch'>) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export function parseCapgoApiVersion(value: string | null | undefined): CapgoApiVersion {
  const raw = value?.trim() || CAPGO_API_DEFAULT_VERSION
  const parsed = parseVersionValue(raw)
  if (!parsed)
    throw new Error('unsupported_api_version')

  const normalized = `${parsed.major}.${parsed.minor}.${parsed.patch}`
  const version = {
    raw,
    normalized,
    ...parsed,
    isDefault: !value,
    equals(other: string) {
      const parsedOther = parseVersionValue(other)
      return !!parsedOther && compareParts(version, parsedOther) === 0
    },
    before(other: string) {
      const parsedOther = parseVersionValue(other)
      return !!parsedOther && compareParts(version, parsedOther) < 0
    },
    atLeast(other: string) {
      const parsedOther = parseVersionValue(other)
      return !!parsedOther && compareParts(version, parsedOther) >= 0
    },
    handle<T>(handlers: Record<number, () => T>) {
      const handler = handlers[version.major]
      if (!handler)
        throw new Error('unsupported_api_version')
      return handler()
    },
  }
  return version
}
