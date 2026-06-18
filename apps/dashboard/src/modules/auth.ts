import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import type { NavigationGuardNext, RouteLocationNormalized, Router } from 'vue-router'
import { createDashboardClient } from '../services/registration'
import { useMainStore } from '../stores/main'
import { type Organization, useOrganizationStore } from '../stores/organization'

interface AuthGuardDeps {
  client?: Pick<SupabaseClient, 'auth' | 'from'> | null
  getSession?: () => Promise<{ data: { session: Session | null }, error?: unknown }>
  getUser?: () => Promise<{ data: { user: User | null }, error?: unknown }>
  fetchOrganizations?: () => Promise<Organization[]>
  hasOrganizations?: () => boolean
  setAuthUser?: (user: User | null) => void
  setOrganizations?: (organizations: Organization[]) => void
}

const publicRoutes = new Set([
  '/login',
  '/register',
  '/sso-callback',
  '/confirm-signup',
  '/forgot_password',
  '/resend_email',
])

function isPublicRoute(path: string) {
  return [...publicRoutes].some(route => path === route || path.startsWith(`${route}/`))
}

function loginRedirect(to: RouteLocationNormalized) {
  return {
    path: '/login',
    query: to.fullPath && to.path !== '/login' ? { to: to.fullPath } : {},
  }
}

function organizationOnboardingRedirect(to: RouteLocationNormalized) {
  return {
    path: '/onboarding/organization',
    query: to.fullPath && !to.path.startsWith('/onboarding/') ? { to: to.fullPath } : {},
  }
}

function shouldRedirectToOrganizationOnboarding(to: RouteLocationNormalized, hasOrganizations: boolean) {
  if (hasOrganizations)
    return false
  if (to.path.startsWith('/onboarding/organization'))
    return false
  return true
}

async function loadOrganizationsFromSupabase(client: Pick<SupabaseClient, 'from'>): Promise<Organization[]> {
  const { data, error } = await client
    .from('orgs')
    .select('id,name,created_by,website,created_at')
    .order('created_at', { ascending: false })

  if (error)
    return []

  return (data ?? []).map(org => ({ ...org, gid: org.id })) as Organization[]
}

export function createAuthGuard(deps: AuthGuardDeps = {}) {
  const client = deps.client ?? createDashboardClient()

  return async function authGuard(to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) {
    if (!to.meta.middleware || isPublicRoute(to.path)) {
      next()
      return
    }

    if (!client) {
      next(loginRedirect(to))
      return
    }

    const getSession = deps.getSession ?? client.auth.getSession.bind(client.auth)
    const sessionResult = await getSession()
    const session = sessionResult.data.session
    if (!session?.access_token) {
      deps.setAuthUser?.(null)
      if (!deps.setAuthUser)
        useMainStore().auth = undefined
      next(loginRedirect(to))
      return
    }

    const getUser = deps.getUser ?? client.auth.getUser.bind(client.auth)
    const userResult = await getUser()
    const user = userResult.data.user ?? session.user ?? null
    if (!user) {
      deps.setAuthUser?.(null)
      if (!deps.setAuthUser)
        useMainStore().auth = undefined
      next(loginRedirect(to))
      return
    }

    if (deps.setAuthUser) {
      deps.setAuthUser(user)
    }
    else {
      const main = useMainStore()
      main.auth = user
      main.user = main.user ?? user
    }

    const organizations = deps.fetchOrganizations ? await deps.fetchOrganizations() : await loadOrganizationsFromSupabase(client)
    if (deps.setOrganizations) {
      deps.setOrganizations(organizations)
    }
    else {
      useOrganizationStore().organizations = organizations
    }

    const hasOrganizations = deps.hasOrganizations ? deps.hasOrganizations() : organizations.length > 0
    if (shouldRedirectToOrganizationOnboarding(to, hasOrganizations)) {
      next(organizationOnboardingRedirect(to))
      return
    }

    next()
  }
}

export function install({ router }: { router: Router }) {
  router.beforeEach(createAuthGuard())
}
