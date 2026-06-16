import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSsoEnforcementGuard } from './sso-enforcement'

function session() {
  return {
    data: {
      session: {
        access_token: 'token-123',
        user: {
          id: 'user-123',
          email: 'user@codepushgo.app',
          app_metadata: { provider: 'email' },
        },
      },
    },
  }
}

describe('[Capgo parity] sso enforcement redirect handling', () => {
  const signOut = vi.fn()
  const getSession = vi.fn()
  const getAdminJwt = vi.fn()
  const fetchImpl = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue(session())
    signOut.mockResolvedValue({ error: null })
    getAdminJwt.mockReturnValue(null)
  })

  function guard() {
    return createSsoEnforcementGuard({ apiHost: 'https://api.capgo.test', fetchImpl, getSession, signOut, getAdminJwt })
  }

  it('redirects to a technical error when the enforcement endpoint returns a non-ok response', async () => {
    fetchImpl.mockResolvedValue({ ok: false, status: 500 } as Response)
    const next = vi.fn()

    await guard()({ path: '/dashboard' }, { path: '/login' }, next)

    expect(signOut).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith('/login?sso_error=enforcement_check_failed')
  })

  it('keeps the explicit SSO-required redirect when enforcement denies password auth', async () => {
    fetchImpl.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ allowed: false }) } as unknown as Response)
    const next = vi.fn()

    await guard()({ path: '/dashboard' }, { path: '/login' }, next)

    expect(signOut).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith('/login?sso_required=true')
  })

  it('sends the stored admin token for backend-verified impersonation bypass', async () => {
    getAdminJwt.mockReturnValue('admin-token-456')
    fetchImpl.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ allowed: true }) } as unknown as Response)
    const next = vi.fn()

    await guard()({ path: '/dashboard' }, { path: '/login' }, next)

    expect(fetchImpl).toHaveBeenCalledWith('https://api.capgo.test/private/sso/check-enforcement', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token-123',
        'X-Capgo-Spoof-Admin-Authorization': 'Bearer admin-token-456',
      }),
    }))
    expect(signOut).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('does not cache allow decisions from impersonation proof for later password checks', async () => {
    getAdminJwt.mockReturnValueOnce('admin-token-456').mockReturnValueOnce(null)
    fetchImpl.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ allowed: true }) } as unknown as Response)

    await guard()({ path: '/dashboard' }, { path: '/login' }, vi.fn())
    await guard()({ path: '/dashboard' }, { path: '/login' }, vi.fn())

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://api.capgo.test/private/sso/check-enforcement', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Capgo-Spoof-Admin-Authorization': 'Bearer admin-token-456' }),
    }))
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://api.capgo.test/private/sso/check-enforcement', expect.objectContaining({
      headers: expect.not.objectContaining({ 'X-Capgo-Spoof-Admin-Authorization': expect.any(String) }),
    }))
  })
})
