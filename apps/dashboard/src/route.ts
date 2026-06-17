export type DashboardRoute = 'register' | 'login' | 'forgot-password' | 'console'

export function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/'
}

export function resolveDashboardRoute(pathname: string): DashboardRoute {
  const path = normalizePath(pathname)
  if (path === '/register')
    return 'register'
  if (path === '/login')
    return 'login'
  if (path === '/forgot_password')
    return 'forgot-password'
  return 'console'
}
