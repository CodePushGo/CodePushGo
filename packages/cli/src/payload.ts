import type { Platform } from '@codepushgo/shared'

export interface UploadPayloadSplit {
  uploadOptions: Record<string, string | boolean | number>
  credentials: Record<string, string>
}

const credentialKeys = new Set(['CODEPUSHGO_TOKEN', 'CODEPUSHGO_PRIVATE_KEY', 'CODEPUSHGO_PUBLIC_KEY'])

export function splitUploadPayload(input: Record<string, unknown>, platform: Platform, cliVersion: string): UploadPayloadSplit {
  const uploadOptions: Record<string, string | boolean | number> = { platform, cliVersion }
  const credentials: Record<string, string> = {}

  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || value.length === 0)
      continue
    if (credentialKeys.has(key))
      credentials[key] = value
    else
      uploadOptions[key] = value
  }

  return { uploadOptions, credentials }
}
