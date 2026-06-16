const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/androidpublisher']

export interface BuilderConfigEnv {
  GOOGLE_OAUTH_CLIENT_ID?: string
  GOOGLE_OAUTH_CLIENT_SECRET?: string
  GOOGLE_OAUTH_SCOPES?: string
}

export interface BuilderConfigDisabled {
  enabled: false
}

export interface BuilderConfigEnabled {
  enabled: true
  clientId: string
  clientSecret: string
  scopes: string[]
}

export type BuilderConfig = BuilderConfigDisabled | BuilderConfigEnabled

export function parseBuilderScopes(raw: string | undefined) {
  if (!raw)
    return DEFAULT_SCOPES
  const parsed = raw.split(',').map(scope => scope.trim()).filter(Boolean)
  return parsed.length > 0 ? parsed : DEFAULT_SCOPES
}

export function getBuilderConfig(env: BuilderConfigEnv = ((globalThis as { process?: { env?: BuilderConfigEnv } }).process?.env ?? {})): BuilderConfig {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? ''
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? ''
  if (!clientId || !clientSecret)
    return { enabled: false }

  return {
    enabled: true,
    clientId,
    clientSecret,
    scopes: parseBuilderScopes(env.GOOGLE_OAUTH_SCOPES),
  }
}
