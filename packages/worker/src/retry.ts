export interface RetryOptions<T> {
  attempts: number
  baseDelayMs: number
  shouldRetry?: (result: T) => boolean
}

export interface RetryOutcome<T> {
  result?: T
  lastError?: unknown
  attempts: number
}

export interface RetryableResult<T = unknown> {
  data?: T | null
  error?: unknown
  status?: number | null
}

export function getRetryablePostgrestStatus(candidate: unknown): number | null {
  if (!candidate || typeof candidate !== 'object')
    return null

  if ('status' in candidate && typeof candidate.status === 'number')
    return candidate.status

  if ('message' in candidate && typeof candidate.message === 'string') {
    const match = /error code:\s*(\d{3})/i.exec(candidate.message)
    if (match)
      return Number.parseInt(match[1], 10)
  }

  return null
}

export function isRetryablePostgrestStatus(status: number | null): boolean {
  return status !== null && status >= 500 && status < 600
}

export function isRetryablePostgrestError(error: unknown): boolean {
  return isRetryablePostgrestStatus(getRetryablePostgrestStatus(error))
}

export function isRetryablePostgrestResult(result: RetryableResult | null | undefined): boolean {
  if (!result)
    return false

  const status = typeof result.status === 'number' ? result.status : getRetryablePostgrestStatus(result.error)
  return isRetryablePostgrestStatus(status)
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions<T>,
): Promise<RetryOutcome<T>> {
  let lastError: unknown
  let result: T | undefined

  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      result = await operation()
      lastError = undefined

      const shouldRetry = options.shouldRetry?.(result) ?? false
      if (!shouldRetry)
        return { result, lastError, attempts: attempt + 1 }
    }
    catch (error) {
      lastError = error
    }

    if (attempt < options.attempts - 1 && options.baseDelayMs > 0)
      await new Promise(resolve => setTimeout(resolve, options.baseDelayMs * (attempt + 1)))
  }

  return { result, lastError, attempts: options.attempts }
}

export async function runSupabaseResultWithRetry<T>(
  label: string,
  operation: () => Promise<RetryableResult<T>>,
  options: { attempts?: number, baseDelayMs?: number } = {},
): Promise<RetryableResult<T>> {
  const { result } = await retryWithBackoff(async () => {
    try {
      return await operation()
    }
    catch (error) {
      return { data: null, error }
    }
  }, {
    attempts: options.attempts ?? 3,
    baseDelayMs: options.baseDelayMs ?? 1,
    shouldRetry: result => isRetryablePostgrestResult(result),
  })

  if (!result)
    throw new Error(`${label} returned no result`)

  if (result.error)
    throw result.error

  if (typeof result.status === 'number' && result.status >= 400)
    throw new Error(`${label} failed with status ${result.status}`)

  return result
}
