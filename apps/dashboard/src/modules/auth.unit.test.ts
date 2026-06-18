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

  it('loads organizations through the Supabase orgs query when no fetch override is provided', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'org_1', name: 'Acme', created_by: 'user_123', website: null, created_at: '2026-06-18' }], error: null })
    const select = vi.fn(() => ({ order }))
    const from = vi.fn(() => ({ select }))
    const setOrganizations = vi.fn()

    const next = await runGuard({
      client: { auth: {}, from } as any,
      getSession: async () => ({ data: { session: { access_token: 'token', user: user() } as any } }),
      getUser: async () => ({ data: { user: user() } }),
      setAuthUser: vi.fn(),
      setOrganizations,
    })

    expect(from).toHaveBeenCalledWith('orgs')
    expect(select).toHaveBeenCalledWith('id,name,created_by,website,created_at')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(setOrganizations).toHaveBeenCalledWith([expect.objectContaining({ id: 'org_1', gid: 'org_1' })])
    expect(next).toHaveBeenCalledWith()
  })

  it('treats Supabase org query errors as no organization and sends users to onboarding', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: new Error('rls denied') })
    const select = vi.fn(() => ({ order }))
    const from = vi.fn(() => ({ select }))
    const setOrganizations = vi.fn()

    const next = await runGuard({
      client: { auth: {}, from } as any,
      getSession: async () => ({ data: { session: { access_token: 'token', user: user() } as any } }),
      getUser: async () => ({ data: { user: user() } }),
      setAuthUser: vi.fn(),
      setOrganizations,
    })

    expect(setOrganizations).toHaveBeenCalledWith([])
    expect(next).toHaveBeenCalledWith({ path: '/onboarding/organization', query: { to: '/app/home' } })
  })
})
