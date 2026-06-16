export class InvalidOrganizationWebsiteError extends Error {
  readonly code = 'website_must_be_a_valid_url'

  constructor() {
    super('Website must be a valid URL')
  }
}

export function normalizeWebsiteUrl(input?: string | null) {
  const trimmed = input?.trim()
  if (!trimmed)
    return null

  try {
    const hasExplicitScheme = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    if (hasExplicitScheme && !/^https?:\/\//i.test(trimmed))
      throw new Error('invalid website protocol')

    const normalized = new URL(hasExplicitScheme ? trimmed : `https://${trimmed}`)
    if (normalized.protocol !== 'http:' && normalized.protocol !== 'https:')
      throw new Error('invalid website protocol')
    if (normalized.username || normalized.password)
      throw new Error('invalid website credentials')

    normalized.protocol = normalized.protocol.toLowerCase()
    normalized.hostname = normalized.hostname.toLowerCase()
    return normalized.toString()
  }
  catch {
    throw new InvalidOrganizationWebsiteError()
  }
}
