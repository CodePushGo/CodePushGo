export interface R2LikeRange {
  offset?: number
  length?: number
  suffix?: number
}

export function calculateBytesTransferred(objectSize: number, range?: R2LikeRange | null) {
  if (!range)
    return objectSize
  if (typeof range.length === 'number' && Number.isFinite(range.length))
    return Math.max(0, Math.min(objectSize, range.length))
  if (typeof range.suffix === 'number' && Number.isFinite(range.suffix))
    return Math.max(0, Math.min(objectSize, range.suffix))
  return objectSize
}

export function buildRangeResponseHeaders(objectSize: number, range?: R2LikeRange | null) {
  const bytes = calculateBytesTransferred(objectSize, range)
  const headers = new Headers({ 'content-length': String(bytes) })
  if (range && typeof range.offset === 'number' && typeof range.length === 'number') {
    const start = Math.max(0, range.offset)
    const end = Math.min(objectSize - 1, start + range.length - 1)
    headers.set('content-range', `bytes ${start}-${end}/${objectSize}`)
  }
  return headers
}

export function shouldTrackBandwidth(method: string, cached: boolean) {
  return method !== 'HEAD' && !cached
}
