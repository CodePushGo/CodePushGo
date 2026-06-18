import { describe, expect, it, vi } from 'vitest'
import { createAuthGuard } from './auth'

function route(path: string, middleware = true) {
  return { path, fullPath: path, meta: middleware ? { middleware: 'auth' } : {}, query: {} } as any
}

function user() {
  return { id: 'user_123', email: 'user@example.com' } as any
}

async function runGuard(options: Parameters<typeof createAuthGuard>[0], path = '/app/home') {
  const next = vi.fn()
  await createAuthGuard(options)(route(path), route('/login', false), next)
  return next
}

describe('[Capgo parity] auth guard', () => {
  it('redirects protected routes without a Supabase session to login with the target path', async () => {
    const next = await runGuard({
      client: { auth: {} } as any,
      getSession: async () => ({ data: { session: null } }),
    })

    expect(next).toHaveBeenCalledWith({ path: '/login', query: { to: '/app/home' } })
  })

  it('loads auth and redirects authenticated users without organizations to organization onboarding', async () => {
    const setAuthUser = vi.fn()
    const setOrganizations = vi.fn()
    const next = await runGuard({
      client: { auth: {} } as any,
      getSession: async () => ({ data: { session: { access_token: 'token', user: user() } as any } }),
      getUser: async () => ({ data: { user: user() } }),
      fetchOrganizations: async () => [],
      setAuthUser,
      setOrganizations,
    })

    expect(setAuthUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'user_123' }))
    expect(setOrganizations).toHaveBeenCalledWith([])
    expect(next).toHaveBeenCalledWith({ path: '/onboarding/organization', query: { to: '/app/home' } })
  })

  it('allows organization onboarding itself for authenticated users without organizations', async () => {
    const next = await runGuard({
      client: { auth: {} } as any,
      getSession: async () => ({ data: { session: { access_token: 'token', user: user() } as any } }),
      getUser: async () => ({ data: { user: user() } }),
      fetchOrganizations: async () => [],
      setAuthUser: vi.fn(),
      setOrganizations: vi.fn(),
    }, '/onboarding/organization')

    expect(next).toHaveBeenCalledWith()
  })

  it('allows protected routes after organizations are loaded', async () => {
    const next = await runGuard({
      client: { auth: {} } as any,
      getSession: async () => ({ data: { session: { access_token: 'token', user: user() } as any } }),
      getUser: async () => ({ data: { user: user() } }),
      fetchOrganizations: async () => [{ gid: 'org_1', id: 'org_1', name: 'Acme' }],
      setAuthUser: vi.fn(),
      setOrganizations: vi.fn(),
    })

    expect(next).toHaveBeenCalledWith()
  })
})
