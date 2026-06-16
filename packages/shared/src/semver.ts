export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  rest: string
}

export function parseVersion(version: string): ParsedVersion | undefined {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(.*)$/)
  if (!match)
    return undefined

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    rest: match[4] ?? '',
  }
}

export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a)
  const parsedB = parseVersion(b)

  if (!parsedA || !parsedB)
    return a.localeCompare(b)

  for (const key of ['major', 'minor', 'patch'] as const) {
    const diff = parsedA[key] - parsedB[key]
    if (diff !== 0)
      return diff
  }

  if (parsedA.rest === parsedB.rest)
    return 0
  if (!parsedA.rest)
    return 1
  if (!parsedB.rest)
    return -1
  return parsedA.rest.localeCompare(parsedB.rest)
}

export function isVersionGreater(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}
