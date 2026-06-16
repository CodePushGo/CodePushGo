const sensitiveRequestBodyKeys = new Set([
  'captchaToken',
  'captcha_token',
  'invite_magic_string',
  'magic_invite_string',
  'password',
])

export function omitSensitiveRequestBody(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(omitSensitiveRequestBody)

  if (!value || typeof value !== 'object')
    return value

  return Object.fromEntries(Object.entries(value).flatMap(([key, entryValue]) => {
    if (sensitiveRequestBodyKeys.has(key))
      return []
    return [[key, omitSensitiveRequestBody(entryValue)]]
  }))
}

export function cloudlog(message: unknown) {
  console.log(message)
}

export function cloudlogErr(message: unknown) {
  console.error(message)
}

export function serializeError(error: unknown) {
  return {
    cause: error instanceof Error ? error.cause : undefined,
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'Error',
    stack: error instanceof Error ? error.stack ?? 'N/A' : 'N/A',
  }
}
