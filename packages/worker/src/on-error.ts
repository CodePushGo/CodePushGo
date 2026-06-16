const drizzleErrorNames = new Set(['DrizzleError', 'DrizzleQueryError', 'TransactionRollbackError'])
const filesUploadFunctionNames = new Set(['files', 'TUS handler'])
const sensitiveRequestBodyKeys = new Set(['captchaToken', 'captcha_token', 'invite_magic_string', 'magic_invite_string', 'password'])

export interface WorkerErrorContext {
  get(key: string): unknown
  json(body: unknown, status: number): unknown
  req: {
    method: string
    raw?: Request
    url: string
  }
}

export interface WorkerErrorDeps {
  backgroundTask: (c: WorkerErrorContext, promise: Promise<unknown>) => unknown
  capturePosthogException: (c: WorkerErrorContext, payload: Record<string, unknown>) => Promise<unknown>
  sendDiscordAlert500: (c: WorkerErrorContext, functionName: string, body: string, error: unknown) => Promise<unknown>
  cloudlogErr?: (message: unknown) => void
}

export interface SimpleErrorResponse {
  error: string
  message: string
  moreInfo: Record<string, unknown>
}

function redactSensitiveRequestBody(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(redactSensitiveRequestBody)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [
    key,
    sensitiveRequestBodyKeys.has(key) ? '[redacted]' : redactSensitiveRequestBody(entryValue),
  ]))
}

function serializeError(error: unknown) {
  if (error instanceof Error)
    return { name: error.name, message: error.message, stack: error.stack ?? 'N/A', cause: error.cause }
  return { name: 'Error', message: String(error), stack: 'N/A' }
}

function isFilesDurableObjectStorageTimeout(functionName: string, error: unknown) {
  if (!filesUploadFunctionNames.has(functionName) || !error || typeof error !== 'object' || !('message' in error))
    return false
  const message = (error as { message?: unknown }).message
  if (typeof message !== 'string')
    return false
  const normalized = message.toLowerCase()
  return normalized.includes('storage operation exceeded timeout') && normalized.includes('object to be reset')
}

function isHttpException(error: unknown): error is { status: number, cause?: unknown, getResponse?: () => Response, res?: unknown, message?: string } {
  return !!error && typeof error === 'object' && typeof (error as { status?: unknown }).status === 'number'
}

function isDrizzleError(error: unknown) {
  if (!error || typeof error !== 'object')
    return false
  const candidate = error as { name?: unknown, entityKind?: unknown }
  return (typeof candidate.name === 'string' && drizzleErrorNames.has(candidate.name))
    || (typeof candidate.entityKind === 'string' && drizzleErrorNames.has(candidate.entityKind))
}

async function readRequestBody(c: WorkerErrorContext) {
  let body = 'N/A'
  const method = c.req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
    return body

  try {
    const rawReq = c.req.raw
    if (rawReq?.bodyUsed) {
      body = 'Body already consumed'
    }
    else {
      const textBody = await rawReq?.clone().text()
      if (textBody) {
        try {
          body = JSON.stringify(redactSensitiveRequestBody(JSON.parse(textBody)))
        }
        catch {
          body = textBody
        }
      }
      else {
        body = '(empty body)'
      }
    }
    return body.length > 1000 ? `${body.substring(0, 1000)}... (truncated)` : body
  }
  catch (failToReadBody) {
    return `Failed to read body (${JSON.stringify(failToReadBody)})`
  }
}

async function responseFromHttpException(error: { status: number, cause?: unknown, getResponse?: () => Response, res?: unknown, message?: string }) {
  const fallback: SimpleErrorResponse = { error: 'unknown_error', message: 'Unknown error', moreInfo: {} }
  if (error.cause && typeof error.cause === 'object' && 'error' in error.cause) {
    const cause = error.cause as { error?: unknown, message?: unknown, moreInfo?: unknown }
    return {
      error: typeof cause.error === 'string' ? cause.error : 'unknown_error',
      message: typeof cause.message === 'string' ? cause.message : error.message || 'Unknown error',
      moreInfo: cause.moreInfo && typeof cause.moreInfo === 'object' ? cause.moreInfo as Record<string, unknown> : {},
    }
  }
  if (error.res && error.getResponse) {
    try {
      const parsed = await error.getResponse().json() as { error?: unknown, message?: unknown, moreInfo?: unknown }
      return {
        error: typeof parsed.error === 'string' ? parsed.error : 'unknown_error',
        message: typeof parsed.message === 'string' ? parsed.message : 'Unknown error',
        moreInfo: parsed.moreInfo && typeof parsed.moreInfo === 'object' ? parsed.moreInfo as Record<string, unknown> : {},
      }
    }
    catch {
      return fallback
    }
  }
  return fallback
}

export function createOnError(functionName: string, deps: WorkerErrorDeps) {
  return async (error: unknown, c: WorkerErrorContext) => {
    const body = await readRequestBody(c)
    const defaultResponse: SimpleErrorResponse = { error: 'unknown_error', message: 'Unknown error', moreInfo: {} }

    if (isHttpException(error)) {
      const response = await responseFromHttpException(error)
      deps.cloudlogErr?.({ requestId: c.get('requestId'), functionName, kind: 'http_exception', method: c.req.method, url: c.req.url, status: error.status, errorCode: response.error, errorMessage: response.message, moreInfo: response.moreInfo, stack: serializeError(error).stack })
      const suppressDiscordAlert = !!(error.cause && typeof error.cause === 'object' && (error.cause as { suppressDiscordAlert?: unknown }).suppressDiscordAlert === true)
      if (error.status >= 500 && !suppressDiscordAlert) {
        await deps.backgroundTask(c, deps.sendDiscordAlert500(c, functionName, body, error))
        void deps.backgroundTask(c, deps.capturePosthogException(c, { error, functionName, kind: 'http_exception', status: error.status }))
      }
      return c.json(response, error.status)
    }

    if (isDrizzleError(error)) {
      deps.cloudlogErr?.({ requestId: c.get('requestId'), functionName, kind: 'drizzle_error', method: c.req.method, url: c.req.url, errorMessage: (error as { message?: string }).message ?? 'Unknown error', stack: serializeError(error).stack, moreInfo: { drizzleErrorCause: serializeError((error as Error).cause) } })
      await deps.backgroundTask(c, deps.sendDiscordAlert500(c, functionName, body, error))
      void deps.backgroundTask(c, deps.capturePosthogException(c, { error, functionName, kind: 'drizzle_error', status: 500 }))
      return c.json(defaultResponse, 500)
    }

    const suppressDiscordAlert = isFilesDurableObjectStorageTimeout(functionName, error)
    deps.cloudlogErr?.({ requestId: c.get('requestId'), functionName, kind: 'unhandled_error', method: c.req.method, url: c.req.url, errorMessage: (error as { message?: string })?.message ?? 'Unknown error', stack: serializeError(error).stack })
    if (!suppressDiscordAlert)
      await deps.backgroundTask(c, deps.sendDiscordAlert500(c, functionName, body, error))
    void deps.backgroundTask(c, deps.capturePosthogException(c, { error, functionName, kind: 'unhandled_error', status: 500 }))
    return c.json(defaultResponse, 500)
  }
}
