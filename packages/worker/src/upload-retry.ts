export const TUS_VERSION = '1.0.0'
export const X_UPLOAD_HANDLER_RETRYABLE = 'X-Capgo-DO-Retryable'

export interface UploadHandler {
  fetch: (request: Request) => Promise<Response>
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error))
    return ''

  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message.toLowerCase() : ''
}

export function isRetryableDurableObjectResetError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const candidate = error as { durableObjectReset?: boolean, overloaded?: boolean, retryable?: boolean }
    if (candidate.retryable || candidate.durableObjectReset || candidate.overloaded)
      return true
  }

  const message = getErrorMessage(error)
  return [
    'moved to a different machine',
    'storage operation exceeded timeout',
    'caused object to be reset',
    'network connection lost',
  ].some(fragment => message.includes(fragment))
}

function isRetryableDurableObjectResponse(response: Response): boolean {
  return response.headers.get(X_UPLOAD_HANDLER_RETRYABLE) === '1'
}

function isExplicitZeroLength(request: Request): boolean {
  return request.headers.get('content-length') === '0'
}

function canReplayUploadRequest(request: Request): boolean {
  if (request.body == null)
    return true

  if (request.method === 'POST')
    return isExplicitZeroLength(request)

  if (request.method === 'PATCH')
    return isExplicitZeroLength(request)

  return false
}

async function buildReplayableRequestFactory(request: Request): Promise<() => Request> {
  const headers = new Headers(request.headers)
  const init: RequestInit & { duplex?: 'half' } = {
    headers,
    method: request.method,
  }

  if (request.body == null)
    return () => new Request(request.url, init)

  const body = await request.arrayBuffer()
  return () => {
    const requestInit: RequestInit & { duplex?: 'half' } = {
      ...init,
      body: body.slice(0),
      duplex: 'half',
    }
    return new Request(request.url, requestInit)
  }
}
function buildForwardOnlyRequest(request: Request): Request {
  const init: RequestInit & { duplex?: 'half' } = {
    headers: request.headers,
    method: request.method,
  }

  if (request.body != null) {
    init.body = request.body
    init.duplex = 'half'
  }

  return new Request(request.url, init)
}

function retryableUploadUnavailableResponse(): Response {
  return new Response(JSON.stringify({
    error: 'upload_retryable',
    message: 'Upload temporarily unavailable. Retry the upload request.',
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '1',
      'Tus-Resumable': TUS_VERSION,
    },
  })
}

async function recoverUploadOffsetFromDurableObject(
  handler: UploadHandler,
  request: Request,
  fallbackResponse: Response,
): Promise<Response> {
  if (request.method !== 'PATCH')
    return fallbackResponse

  try {
    const headers = new Headers(request.headers)
    headers.delete('content-length')
    const headResponse = await handler.fetch(new Request(request.url, {
      method: 'HEAD',
      headers,
    }))
    const uploadOffset = headResponse.headers.get('Upload-Offset')

    if (!headResponse.ok || uploadOffset == null)
      return fallbackResponse

    return new Response(null, {
      status: 409,
      headers: new Headers(headResponse.headers),
    })
  }
  catch {
    return fallbackResponse
  }
}

export async function fetchUploadHandlerWithRetry(
  handler: UploadHandler,
  request: Request,
  options: { attempts?: number, delayMs?: number } = {},
): Promise<Response> {
  const canRetryRequest = canReplayUploadRequest(request)
  const maxAttempts = canRetryRequest ? (options.attempts ?? 3) : 1
  const delayMs = options.delayMs ?? 1
  const requestFactory = canRetryRequest
    ? await buildReplayableRequestFactory(request)
    : () => buildForwardOnlyRequest(request)
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await handler.fetch(requestFactory())
      const shouldRetryResponse = canRetryRequest
        && attempt < maxAttempts
        && isRetryableDurableObjectResponse(response)

      if (shouldRetryResponse) {
        if (delayMs > 0)
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
        continue
      }

      if (!canRetryRequest && isRetryableDurableObjectResponse(response))
        return await recoverUploadOffsetFromDurableObject(handler, request, response)

      return response
    }
    catch (error) {
      lastError = error
      const retryableError = isRetryableDurableObjectResetError(error)
      const shouldRetry = canRetryRequest && attempt < maxAttempts && retryableError

      if (!shouldRetry) {
        if (retryableError)
          return retryableUploadUnavailableResponse()

        throw error
      }

      if (delayMs > 0)
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
    }
  }

  throw lastError ?? new Error('Durable Object upload fetch failed')
}
