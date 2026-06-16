export type CliErrorCategory
  = | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'timeout'
    | 'payload_too_large'
    | 'rate_limited'
    | 'validation_error'
    | 'server_error'
    | 'network_error'
    | 'commander'
    | 'unknown'

interface MaybeStatus {
  status?: unknown
}

interface MaybeCode {
  code?: unknown
}

export function categorizeHttpStatus(status: number): CliErrorCategory {
  if (status === 401)
    return 'unauthorized'
  if (status === 403)
    return 'forbidden'
  if (status === 404)
    return 'not_found'
  if (status === 408 || status === 504)
    return 'timeout'
  if (status === 413)
    return 'payload_too_large'
  if (status === 429)
    return 'rate_limited'
  if (status === 400 || status === 422)
    return 'validation_error'
  if (status >= 500 && status <= 599)
    return 'server_error'
  return 'unknown'
}

export function categorizeCliError(error: unknown): CliErrorCategory {
  if (!error || typeof error !== 'object')
    return 'unknown'

  const status = (error as MaybeStatus).status
  if (typeof status === 'number')
    return categorizeHttpStatus(status)

  const code = (error as MaybeCode).code
  if (code === 'commander.help' || code === 'commander.version' || code === 'commander.unknownCommand')
    return 'commander'

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes('econnrefused') || message.includes('fetch failed') || message.includes('network'))
    return 'network_error'
  if (message.includes('timeout') || message.includes('timed out'))
    return 'timeout'
  if (message.includes('invalid') || message.includes('required') || message.includes('validation'))
    return 'validation_error'

  return 'unknown'
}
