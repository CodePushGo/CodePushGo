import { describe, expect, it, vi } from 'vitest'
import { clearSsoEnforcementCache, createSsoEnforcementGuard, isPublicRoute, PUBLIC_ROUTES } from './sso-enforcement'

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
  }
}

function session(provider = 'email') {
  return {
    access_token: 'token',
    user: {
      id: 'user_123',
      email: 'user@example.com',
      app_metadata: { provider },
    },
  }
}

async function runGuard(deps: Parameters<typeof createSsoEnforcementGuard>[0], path = '/app/home') {
  const next = vi.fn()
  const guard = createSsoEnforcementGuard(deps)
  await guard({ path }, {}, next)
  return next
}

describe('[Capgo parity] SSO enforcement guard', () => {
  it('keeps Capgo auth routes public', () => {
    expect(PUBLIC_ROUTES).toEqual(expect.arrayContaining([
      '/login',
      '/register',
      '/sso-callback',
      '/confirm-signup',
      '/forgot_password',
      '/resend_email',
      '/onboarding/set_password',
      '/accountDisabled',
    ]))
    expect(isPublicRoute('/sso-callback')).toBe(true)
    expect(isPublicRoute('/forgot_password/step')).toBe(true)
    expect(isPublicRoute('/app/home')).toBe(false)
  })

  it('does not call enforcement for public routes', async () => {
    const fetchImpl = vi.fn()
    const next = await runGuard({ fetchImpl, getSession: async () => ({ data: { session: session() } }) as any }, '/sso-callback')

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('skips enforcement for non-email providers', async () => {
    const fetchImpl = vi.fn()
    const next = await runGuard({ fetchImpl, getSession: async () => ({ data: { session: session('saml') } }) as any })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('posts the Capgo enforcement payload for email sessions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ allowed: true }) })
    const storage = memoryStorage()
    const next = await runGuard({
      apiHost: 'https://api.test',
      fetchImpl,
      storage,
      now: () => 1000,
      getSession: async () => ({ data: { session: session() } }) as any,
      getAdminJwt: () => null,
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/private/sso/check-enforcement', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ email: 'user@example.com', auth_type: 'password' }),
    }))
    expect(storage.setItem).toHaveBeenCalledWith('sso_enforcement_checked_v2', JSON.stringify({ timestamp: 1000, cachedUserId: 'user_123' }))
    expect(next).toHaveBeenCalledWith()
  })

  it('uses the successful check cache for the same user', async () => {
    const fetchImpl = vi.fn()
    const storage = memoryStorage({
      sso_enforcement_checked_v2: JSON.stringify({ timestamp: 1000, cachedUserId: 'user_123' }),
    })

    const next = await runGuard({
      fetchImpl,
      storage,
      now: () => 2000,
      getSession: async () => ({ data: { session: session() } }) as any,
      getAdminJwt: () => null,
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('fails closed when enforcement rejects or errors', async () => {
    const signOut = vi.fn()
    const deniedNext = await runGuard({
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ allowed: false }) }),
      signOut,
      storage: memoryStorage(),
      getSession: async () => ({ data: { session: session() } }) as any,
      getAdminJwt: () => null,
    })

    expect(signOut).toHaveBeenCalled()
    expect(deniedNext).toHaveBeenCalledWith('/login?sso_required=true')

    const errorSignOut = vi.fn()
    const errorNext = await runGuard({
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
      signOut: errorSignOut,
      storage: memoryStorage(),
      getSession: async () => ({ data: { session: session() } }) as any,
      getAdminJwt: () => null,
    })

    expect(errorSignOut).toHaveBeenCalled()
    expect(errorNext).toHaveBeenCalledWith('/login?sso_error=enforcement_check_failed')
  })

  it('clears the enforcement cache', () => {
    const storage = memoryStorage({ sso_enforcement_checked_v2: 'cached' })
    clearSsoEnforcementCache(storage)

    expect(storage.removeItem).toHaveBeenCalledWith('sso_enforcement_checked_v2')
  })
})
