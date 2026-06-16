import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('[Capgo parity] i18n remote message loading', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('localStorage', {
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the current locale and shows a pending notice when the backend is still preparing translations', async () => {
    const notifyInfo = vi.fn()
    const changeFormLocale = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'pending' }), { status: 202 })))

    const { changeLanguage } = await import('./i18n')
    const { i18n } = await import('../modules/i18n')

    const selectedLanguage = await changeLanguage('fr', { changeFormLocale, notifyInfo })

    expect(selectedLanguage).toBe('en')
    expect(i18n.global.locale.value).toBe('en')
    expect(changeFormLocale).not.toHaveBeenCalled()
    expect(notifyInfo).toHaveBeenCalledWith('Translation is being prepared. Try again in a bit.')
  })

  it('keeps the current locale and shows an unavailable notice when the backend fails', async () => {
    const notifyError = vi.fn()
    const changeFormLocale = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'translation_unavailable' }), { status: 503 })))

    const { changeLanguage } = await import('./i18n')
    const { i18n } = await import('../modules/i18n')

    const selectedLanguage = await changeLanguage('fr', { changeFormLocale, notifyError })

    expect(selectedLanguage).toBe('en')
    expect(i18n.global.locale.value).toBe('en')
    expect(changeFormLocale).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledWith('This language is not available right now.')
  })

  it('keeps the stored startup locale when backend translation is pending', async () => {
    const stored = new Map<string, string>([['lang', 'fr']])
    const setItem = vi.fn((key: string, value: string) => stored.set(key, value))
    vi.stubGlobal('localStorage', {
      clear: vi.fn(() => stored.clear()),
      getItem: vi.fn((key: string) => stored.get(key) ?? null),
      removeItem: vi.fn((key: string) => stored.delete(key)),
      setItem,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'pending' }), { status: 202 })))

    const { install, i18n } = await import('../modules/i18n')

    install({ app: { use: vi.fn() } })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(i18n.global.locale.value).toBe('en')
    expect(stored.get('lang')).toBe('fr')
    expect(setItem).not.toHaveBeenCalledWith('lang', 'en')
  })

  it('loads backend messages before switching locale', async () => {
    const changeFormLocale = vi.fn()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      messages: {
        'credits-plan-overage': '{included}, puis {price}',
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { changeLanguage } = await import('./i18n')
    const { i18n } = await import('../modules/i18n')

    const selectedLanguage = await changeLanguage('fr', { changeFormLocale })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const request = JSON.parse(init.body as string) as { targetLanguage?: string }

    expect(selectedLanguage).toBe('fr')
    expect(i18n.global.locale.value).toBe('fr')
    expect(changeFormLocale).toHaveBeenCalledWith('fr')
    expect(request).toEqual({ targetLanguage: 'fr' })
    expect(i18n.global.t('credits-plan-overage', {
      included: 'Included in plan',
      price: '$0.08 per minute',
    })).toBe('Included in plan, puis $0.08 per minute')
  })
})
