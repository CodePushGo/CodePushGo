import { i18n } from '../modules/i18n'

export interface ChangeLanguageOptions {
  persist?: boolean
  changeFormLocale?: (locale: string) => void
  notifyInfo?: (message: string) => void
  notifyError?: (message: string) => void
}

function storeLanguage(locale: string) {
  try {
    globalThis.localStorage?.setItem('lang', locale)
  }
  catch {
    // Storage can be unavailable in private contexts; locale switching should still work.
  }
}

export async function changeLanguage(locale: string, options: ChangeLanguageOptions = {}) {
  const currentLocale = i18n.global.locale.value
  const response = await fetch('/i18n/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetLanguage: locale }),
  })

  if (response.status === 202) {
    options.notifyInfo?.('Translation is being prepared. Try again in a bit.')
    return currentLocale
  }

  if (!response.ok) {
    options.notifyError?.('This language is not available right now.')
    return currentLocale
  }

  const body = await response.json() as { messages?: Record<string, string> }
  i18n.global.setLocaleMessage(locale, body.messages ?? {})
  i18n.global.locale.value = locale
  options.changeFormLocale?.(locale)
  if (options.persist !== false)
    storeLanguage(locale)
  return locale
}
