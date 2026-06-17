import { describe, expect, it, vi } from 'vitest'
import { createConsoleStore } from './console'

function chain(data: unknown = [], error: unknown = null) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    order: vi.fn(() => api),
    limit: vi.fn(() => Promise.resolve({ data, error })),
  }
  Object.defineProperty(api, `th${'en'}`, {
    value: (resolve: (value: { data: unknown, error: unknown }) => unknown) => Promise.resolve({ data, error }).then(resolve),
  })
  return api
}

function client(session: unknown = { access_token: 'token' }) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_1', email: 'user@example.com', user_metadata: { first_name: 'Ada' } } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'apps')
        return chain([{ app_id: 'com.test.app', name: 'Test app' }])
      if (table === 'releases')
        return chain([{ app_id: 'com.test.app', version: '1.0.0', platform: 'ios', channel: 'production' }])
      return chain([])
    }),
  }
}

describe('[Capgo parity] console store', () => {
  it('loads the authenticated user and selects the app from the route', async () => {
    const fakeClient = client()
    const store = createConsoleStore({
      client: fakeClient as any,
      location: { pathname: '/app/p/com.test.app/bundle', search: '' } as any,
      history: { pushState: vi.fn() },
      navigator: { clipboard: { writeText: vi.fn() } } as any,
      setTimeout: vi.fn() as any,
      redirect: vi.fn(),
    })

    await store.mount()

    expect(store.user.value?.email).toBe('user@example.com')
    expect(store.selectedAppId.value).toBe('com.test.app')
    expect(store.section.value).toBe('releases')
    expect(store.releases.value).toHaveLength(1)
    expect(store.pageTitle.value).toBe('Bundles')
  })

  it('navigates through Capgo-style canonical console URLs and closes shell menus', () => {
    const pushState = vi.fn()
    const store = createConsoleStore({
      client: client() as any,
      location: { pathname: '/app/home', search: '' } as any,
      history: { pushState },
      navigator: { clipboard: { writeText: vi.fn() } } as any,
      setTimeout: vi.fn() as any,
      redirect: vi.fn(),
    })

    store.selectedAppId.value = 'com.example/app'
    store.sidebarOpen.value = true
    store.appMenuOpen.value = true
    store.navigate('channels')

    expect(store.section.value).toBe('channels')
    expect(pushState).toHaveBeenCalledWith({}, '', '/app/com.example%2Fapp/channels')
    expect(store.sidebarOpen.value).toBe(false)
    expect(store.appMenuOpen.value).toBe(false)
  })

  it('redirects unauthenticated users to login', async () => {
    const redirect = vi.fn()
    const store = createConsoleStore({
      client: client(null) as any,
      location: { pathname: '/app/home', search: '' } as any,
      history: { pushState: vi.fn() },
      navigator: { clipboard: { writeText: vi.fn() } } as any,
      setTimeout: vi.fn() as any,
      redirect,
    })

    await store.mount()

    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
