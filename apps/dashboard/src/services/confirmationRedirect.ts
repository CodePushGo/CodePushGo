export interface ConfirmationRedirectConfig {
  consoleUrl: string
  supabaseUrl: string
  dev?: boolean
  origin?: string
}

export interface ConfirmationRedirectResult {
  ok: boolean
  url?: string
  message?: string
}

const invalidConfirmationMessage = 'Invalid confirmation URL. Please check your email link.'

function hostname(value: string) {
  try {
    return new URL(value).hostname
  }
  catch {
    return ''
  }
}

export function resolveConfirmationRedirect(confirmationUrl: string | null | undefined, config: ConfirmationRedirectConfig): ConfirmationRedirectResult {
  if (!confirmationUrl)
    return { ok: false, message: invalidConfirmationMessage }

  let decoded = confirmationUrl
  try {
    decoded = decodeURIComponent(confirmationUrl)
  }
  catch {
    return { ok: false, message: 'Error redirecting to confirmation page. Please try again.' }
  }

  let url: URL
  try {
    url = new URL(decoded, config.origin ?? 'https://console.codepushgo.com')
  }
  catch {
    return { ok: false, message: invalidConfirmationMessage }
  }

  if (config.dev && ['localhost', '127.0.0.1', '::1'].includes(url.hostname))
    return { ok: true, url: url.toString() }

  if (url.protocol !== 'https:')
    return { ok: false, message: invalidConfirmationMessage }

  const allowedHosts = new Set([hostname(config.consoleUrl), hostname(config.supabaseUrl)].filter(Boolean))
  if (!allowedHosts.has(url.hostname))
    return { ok: false, message: invalidConfirmationMessage }

  return { ok: true, url: url.toString() }
}
