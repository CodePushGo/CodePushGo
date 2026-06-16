export interface CiSecretEntry {
  key: string
  value: string
  masked: boolean
}

const allowedSecretKeys = [
  'CODEPUSHGO_ENDPOINT',
  'CODEPUSHGO_APP_ID',
  'CODEPUSHGO_CHANNEL',
  'CODEPUSHGO_PRIVATE_KEY',
  'CODEPUSHGO_PUBLIC_KEY',
] as const

export function createCiSecretEntries(values: Record<string, unknown>, token?: string): CiSecretEntry[] {
  const entries: CiSecretEntry[] = []
  const trimmedToken = token?.trim()
  if (trimmedToken)
    entries.push({ key: 'CODEPUSHGO_TOKEN', value: trimmedToken, masked: true })

  for (const key of allowedSecretKeys) {
    const value = values[key]
    if (typeof value !== 'string' || value.trim().length === 0)
      continue
    entries.push({ key, value: value.trim(), masked: key !== 'CODEPUSHGO_CHANNEL' })
  }

  return entries
}

export function redactSecretValue(value: string) {
  if (value.length <= 6)
    return '*'.repeat(value.length)
  return `${value.slice(0, 3)}${'*'.repeat(Math.min(12, value.length - 6))}${value.slice(-3)}`
}
