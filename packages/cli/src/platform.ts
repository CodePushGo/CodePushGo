import type { Platform } from '@codepushgo/shared'

export function resolvePlatform(value: unknown): Platform {
  if (value === 'ios' || value === 'android')
    return value
  if (typeof value === 'string' && value.trim())
    throw new Error(`Invalid platform "${value}". Expected "ios" or "android"`)
  throw new Error('Missing required platform. Expected "ios" or "android"')
}
