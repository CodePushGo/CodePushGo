import { defaultApiHost, getSpoofedAdminJwt, useSupabase } from '../services/supabase'

interface SessionUser {
  id?: string
  email?: string
  app_metadata?: {
    provider?: string
  }
}

interface Session {
  access_token: string
  user?: SessionUser
}

interface RouteLike {
  path?: string
}

interface RouterLike {
  beforeEach(guard: (to: RouteLike, from: RouteLike, next: (path?: string) => void) => Promise<void>): void
}

interface SsoGuardDeps {
  apiHost?: string
  fetchImpl?: typeof fetch
  getAdminJwt?: () => string | null
  getSession?: () => Promise<{ data: { session: Session | null } }>
  signOut?: () => Promise<unknown>
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  now?: () => number
}

interface SsoEnforcementResponse {
  allowed?: boolean
  reason?: string
}

const SSO_CHECK_CACHE_KEY = 'sso_enforcement_checked_v2'
const SSO_CHECK_CACHE_TTL = 5 * 60 * 1000
const SPOOF_ADMIN_AUTHORIZATION_HEADER = 'X-Capgo-Spoof-Admin-Authorization'

export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/sso-callback',
  '/confirm-signup',
  '/forgot_password',
  '/resend_email',
  '/onboarding/set_password',
  '/accountDisabled',
]

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path === route || path.startsWith(`${route}/`))
}

function isCacheValid(storage: SsoGuardDeps['storage'], userId: string, now: () => number): boolean {
  try {
    const cached = storage?.getItem(SSO_CHECK_CACHE_KEY)
    if (!cached)
      return false
    const { timestamp, cachedUserId } = JSON.parse(cached) as { timestamp?: number, cachedUserId?: string }
    return typeof timestamp === 'number' && now() - timestamp < SSO_CHECK_CACHE_TTL && cachedUserId === userId
  }
  catch {
    return false
  }
}

function setCacheValid(storage: SsoGuardDeps['storage'], userId: string, now: () => number): void {
  try {
    storage?.setItem(SSO_CHECK_CACHE_KEY, JSON.stringify({ timestamp: now(), cachedUserId: userId }))
  }
  catch {}
}

function getDefaultStorage(): SsoGuardDeps['storage'] {
  return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
}
export function clearSsoEnforcementCache(storage: SsoGuardDeps['storage'] = getDefaultStorage()): void {
  try {
    storage?.removeItem(SSO_CHECK_CACHE_KEY)
  }
  catch {}
}

export function createSsoEnforcementGuard(deps: SsoGuardDeps = {}) {
  const supabase = useSupabase()
  const fetchImpl = deps.fetchImpl ?? fetch
  const getSession = deps.getSession ?? supabase.auth.getSession
  const signOut = deps.signOut ?? supabase.auth.signOut
  const storage = deps.storage ?? getDefaultStorage()
  const getAdminJwt = deps.getAdminJwt ?? getSpoofedAdminJwt
  const apiHost = deps.apiHost ?? defaultApiHost
  const now = deps.now ?? Date.now

  return async function ssoEnforcementGuard(to: RouteLike, _from: RouteLike, next: (path?: string) => void) {
    if (to.path && isPublicRoute(to.path)) {
      next()
      return
    }

    const session = (await getSession()).data.session
    if (!session?.access_token) {
      next()
      return
    }

    const provider = session.user?.app_metadata?.provider
    if (provider && provider !== 'email') {
      next()
      return
    }

    const userId = session.user?.id
    if (!userId) {
      next()
      return
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
    const adminJwt = getAdminJwt()
    if (adminJwt)
      headers[SPOOF_ADMIN_AUTHORIZATION_HEADER] = `Bearer ${adminJwt}`
    else if (isCacheValid(storage, userId, now)) {
      next()
      return
    }

    try {
      const response = await fetchImpl(`${apiHost}/private/sso/check-enforcement`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: session.user?.email,
          auth_type: 'password',
        }),
      })

      if (!response.ok) {
        clearSsoEnforcementCache(storage)
        await signOut()
        next('/login?sso_error=enforcement_check_failed')
        return
      }

      const body = await response.json() as SsoEnforcementResponse
      if (!body.allowed) {
        clearSsoEnforcementCache(storage)
        await signOut()
        next('/login?sso_required=true')
        return
      }

      if (!adminJwt)
        setCacheValid(storage, userId, now)
    }
    catch {
      clearSsoEnforcementCache(storage)
      await signOut()
      next('/login?sso_error=enforcement_check_failed')
      return
    }

    next()
  }
}

export function install({ router }: { router: RouterLike }, deps: SsoGuardDeps = {}) {
  router.beforeEach(createSsoEnforcementGuard(deps))
}
