export function isStaleAssetErrorMessage(message: string | undefined) {
  if (!message)
    return false
  const normalized = message.toLowerCase()
  return normalized.includes('failed to fetch dynamically imported module:')
    || normalized.includes('error loading dynamically imported module:')
    || normalized.includes('importing a module script failed')
    || normalized.includes('unable to preload css for')
    || normalized.includes("'text/html' is not a valid javascript mime type")
}

export function isKnownCrawlerNoiseErrorMessage(message: string | undefined) {
  if (!message)
    return false
  return /object not found matching id:\d+/i.test(message)
}

export function getErrorMessage(value: unknown): string | undefined {
  if (value instanceof Error)
    return value.message
  if (typeof value === 'object' && value !== null && 'message' in value && typeof (value as { message?: unknown }).message === 'string')
    return (value as { message: string }).message
  if (typeof value === 'string')
    return value
  return undefined
}

export function shouldSuppressPostHogExceptionEvent(event: unknown) {
  if (!isRecord(event) || event.event !== '$exception' || !isRecord(event.properties))
    return false
  return exceptionMessages(event.properties).some(message => isStaleAssetErrorMessage(message) || isKnownCrawlerNoiseErrorMessage(message))
}

function exceptionMessages(properties: Record<string, unknown>) {
  const messages: string[] = []
  const exceptionList = properties.$exception_list
  if (Array.isArray(exceptionList)) {
    for (const item of exceptionList) {
      if (isRecord(item)) {
        const message = getErrorMessage(item.value) ?? getErrorMessage(item.message)
        if (message)
          messages.push(message)
      }
    }
  }
  const exceptionValues = properties.$exception_values
  if (Array.isArray(exceptionValues)) {
    for (const value of exceptionValues) {
      const message = getErrorMessage(value)
      if (message)
        messages.push(message)
    }
  }
  const directMessage = getErrorMessage(properties.$exception_message)
  if (directMessage)
    messages.push(directMessage)
  return messages
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
