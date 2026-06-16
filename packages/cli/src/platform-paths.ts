import type { Platform } from '@codepushgo/shared'

export function normalizeRelPath(path: string) {
  let normalized = path.trim().replace(/\\+/g, '/')
  while (normalized.startsWith('./'))
    normalized = normalized.slice(2)
  normalized = normalized.replace(/\/+/g, '/')
  normalized = normalized.replace(/\/+$/g, '')
  return normalized === '.' ? '' : normalized
}

export function getPlatformDirFromReactNativeConfig(config: Record<string, unknown>, platform: Platform) {
  const platformConfig = config[platform]
  if (platformConfig && typeof platformConfig === 'object' && !Array.isArray(platformConfig)) {
    const path = (platformConfig as { path?: unknown }).path
    if (typeof path === 'string') {
      const normalized = normalizeRelPath(path)
      if (normalized)
        return normalized
    }
  }
  return platform
}
