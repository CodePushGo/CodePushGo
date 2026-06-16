type Messages = Record<string, string>

const englishMessages: Messages = {
  'credits-plan-overage': '{included}, then {price}',
}

const messageCatalog = new Map<string, Messages>([['en', englishMessages]])

export const i18n = {
  global: {
    locale: { value: 'en' },
    t(key: string, values: Record<string, string | number> = {}) {
      const messages = messageCatalog.get(i18n.global.locale.value) ?? englishMessages
      const template = messages[key] ?? englishMessages[key] ?? key
      return template.replace(/\{([^}]+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
    },
    setLocaleMessage(locale: string, messages: Messages) {
      messageCatalog.set(locale, { ...messageCatalog.get(locale), ...messages })
    },
  },
}

function storedLanguage() {
  try {
    return globalThis.localStorage?.getItem('lang') || 'en'
  }
  catch {
    return 'en'
  }
}

export function install(appContext: { app?: { use?: (plugin: unknown) => void } }) {
  appContext.app?.use?.(i18n)
  const targetLanguage = storedLanguage()
  if (targetLanguage !== 'en') {
    void import('../services/i18n').then(({ changeLanguage }) => changeLanguage(targetLanguage, { persist: false }))
  }
}
