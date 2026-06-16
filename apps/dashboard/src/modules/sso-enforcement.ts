import { defaultApiHost, getSpoofedAdminJwt, useSupabase } from '../services/supabase'

interface SessionUser {
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
}

const publicPaths = new Set(['/login', '/signup', '/auth/callback'])

export function createSsoEnforcementGuard(deps: SsoGuardDeps = {}) {
  const supabase = useSupabase()
  const fetchImpl = deps.fetchImpl ?? fetch
  const getSession = deps.getSession ?? supabase.auth.getSession
  const signOut = deps.signOut ?? supabase.auth.signOut
  const getAdminJwt = deps.getAdminJwt ?? getSpoofedAdminJwt
  const apiHost = deps.apiHost ?? defaultApiHost

  return async function ssoEnforcementGuard(to: RouteLike, _from: RouteLike, next: (path?: string) => void) {
    if (to.path && publicPaths.has(to.path)) {
      next()
      return
    }

    const session = (await getSession()).data.session
    if (!session?.access_token) {
      next()
      return
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
    const adminJwt = getAdminJwt()
    if (adminJwt)
      headers['X-Capgo-Spoof-Admin-Authorization'] = `Bearer ${adminJwt}`

    const response = await fetchImpl(`${apiHost}/private/sso/check-enforcement`, {
      method: 'POST',
      headers,
    })

    if (!response.ok) {
      await signOut()
      next('/login?sso_error=enforcement_check_failed')
      return
    }

    const body = await response.json() as { allowed?: boolean }
    if (!body.allowed) {
      await signOut()
      next('/login?sso_required=true')
      return
    }

    next()
  }
}

export function install({ router }: { router: RouterLike }, deps: SsoGuardDeps = {}) {
  router.beforeEach(createSsoEnforcementGuard(deps))
}
