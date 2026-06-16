export interface ResolvedImagePath {
  normalized: string
  shouldSign: boolean
}

export interface CreateSignedImageUrlOptions {
  forceRefresh?: boolean
}

const signedImageCache = new Map<string, { url: string, expiresAt: number }>()
const signedImageCacheMaxAgeMs = 15 * 60 * 1000
const signedImagesPathMarker = '/storage/v1/object/sign/images/'

function trimPath(value: string | null | undefined) {
  return value?.trim().replace(/^\/+/, '') ?? ''
}

function signedImagePathFromUrl(value: string) {
  try {
    const parsed = new URL(value)
    const markerIndex = parsed.pathname.indexOf(signedImagesPathMarker)
    if (markerIndex === -1)
      return null
    return decodeURIComponent(parsed.pathname.slice(markerIndex + signedImagesPathMarker.length)).replace(/^\/+/, '')
  }
  catch {
    return null
  }
}

export function resolveImagePath(raw: string | null | undefined): ResolvedImagePath {
  const normalized = trimPath(raw)
  if (!normalized)
    return { normalized: '', shouldSign: false }
  const signedPath = signedImagePathFromUrl(normalized)
  if (signedPath)
    return { normalized: signedPath, shouldSign: true }
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:'))
    return { normalized, shouldSign: false }
  return { normalized: normalized.replace(/^images\//, ''), shouldSign: true }
}

export function getImmediateImageUrl(raw: string | null | undefined) {
  const { normalized, shouldSign } = resolveImagePath(raw)
  return shouldSign ? '' : normalized
}

export async function createSignedImageUrl(raw: string | null | undefined, options: CreateSignedImageUrlOptions = {}) {
  const { normalized, shouldSign } = resolveImagePath(raw)
  if (!shouldSign)
    return normalized

  const cached = signedImageCache.get(normalized)
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now())
    return cached.url

  const response = await fetch(`/storage/sign?path=${encodeURIComponent(normalized)}`)
  if (!response.ok)
    return ''

  const body = await response.json() as { url?: string }
  const url = body.url ?? ''
  if (url)
    signedImageCache.set(normalized, { url, expiresAt: Date.now() + signedImageCacheMaxAgeMs })
  return url
}
