import type { Platform } from '@codepushgo/shared'
import { isValidAppId } from '@codepushgo/shared'
import type { CodePushGoConfig } from './config'

export interface CliCredentials {
  token?: string
  endpoint?: string
  appId?: string
  channel?: string
  platform?: Platform
}

type LegacyCredentialTarget = 'token' | 'endpoint' | 'appId' | 'channel'

const legacyEnvMap: Record<string, LegacyCredentialTarget> = {
  CAPGO_TOKEN: 'token',
  CAPGO_ENDPOINT: 'endpoint',
  CAPGO_APP_ID: 'appId',
  CAPGO_CHANNEL: 'channel',
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function loadCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): CliCredentials {
  return {
    token: nonEmpty(env.CODEPUSHGO_TOKEN),
    endpoint: nonEmpty(env.CODEPUSHGO_ENDPOINT),
    appId: nonEmpty(env.CODEPUSHGO_APP_ID),
    channel: nonEmpty(env.CODEPUSHGO_CHANNEL),
  }
}

export function migrateLegacyCredentialEnv(env: Record<string, string | undefined>): CliCredentials {
  const migrated: CliCredentials = {}
  for (const [legacyKey, target] of Object.entries(legacyEnvMap)) {
    const value = nonEmpty(env[legacyKey])
    if (value && !migrated[target])
      migrated[target] = value
  }
  return migrated
}

export function mergeCredentials(config: CodePushGoConfig, env: CliCredentials, cli: CliCredentials): CliCredentials {
  return {
    token: cli.token ?? env.token ?? config.token,
    endpoint: cli.endpoint ?? env.endpoint ?? config.endpoint,
    appId: cli.appId ?? env.appId ?? config.appId,
    channel: cli.channel ?? env.channel ?? config.channel,
    platform: cli.platform ?? env.platform,
  }
}

export function validateCliCredentials(credentials: CliCredentials) {
  const missing: string[] = []
  if (!credentials.token)
    missing.push('CODEPUSHGO_TOKEN')
  if (!credentials.appId)
    missing.push('CODEPUSHGO_APP_ID')
  else if (!isValidAppId(credentials.appId))
    missing.push('CODEPUSHGO_APP_ID must be a reverse-domain React Native bundle id')
  return missing
}
