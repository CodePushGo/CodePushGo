export type DashboardRoute = 'register' | 'login' | 'forgot-password' | 'confirm-signup' | 'resend-email' | 'console'

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
  if (path === '/confirm-signup')
    return 'confirm-signup'
  if (path === '/resend_email')
    return 'resend-email'
  return 'console'
}
