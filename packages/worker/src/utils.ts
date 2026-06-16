interface EnvContext {
  env?: Record<string, unknown>
}

function readContextEnv(context: EnvContext | Record<string, unknown>): Record<string, unknown> {
  if ('env' in context && (context as EnvContext).env)
    return (context as EnvContext).env as Record<string, unknown>

  return context as Record<string, unknown>
}

export function existInEnv(context: EnvContext | Record<string, unknown>, key: string): boolean {
  const env = readContextEnv(context)
  return Object.prototype.hasOwnProperty.call(env, key)
}

export function getEnv(context: EnvContext | Record<string, unknown>, key: string): string {
  const env = readContextEnv(context)
  const value = env[key]
  return typeof value === 'string' ? value : ''
}

export function shouldRetryManifestSizeLookup(storageSize: number | null, trustedSize: number | null): boolean {
  return (storageSize ?? 0) === 0 && (trustedSize ?? 0) === 0
}
