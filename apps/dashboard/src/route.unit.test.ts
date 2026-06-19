import { describe, expect, it } from 'vitest'
import { canonicalRedirects, guestPath } from './routeSurface'
import { resolveDashboardRoute } from './route'

describe('[Capgo parity] dashboard route surface', () => {
  it('routes auth pages before falling through to console', () => {
    expect(resolveDashboardRoute('/register')).toBe('register')
    expect(resolveDashboardRoute('/login')).toBe('login')
    expect(resolveDashboardRoute('/forgot_password')).toBe('forgot-password')
    expect(resolveDashboardRoute('/forgot_password/')).toBe('forgot-password')
    expect(resolveDashboardRoute('/confirm-signup')).toBe('confirm-signup')
    expect(resolveDashboardRoute('/confirm-signup/')).toBe('confirm-signup')
    expect(resolveDashboardRoute('/resend_email')).toBe('resend-email')
    expect(resolveDashboardRoute('/resend_email/')).toBe('resend-email')
    expect(resolveDashboardRoute('/sso-callback')).toBe('sso-callback')
    expect(resolveDashboardRoute('/sso-callback/')).toBe('sso-callback')
    expect(resolveDashboardRoute('/app/home')).toBe('console')
  })

  it('uses Capgo-style guest paths and canonical redirects', () => {
    expect(guestPath).toEqual(expect.arrayContaining([
      '/login',
      '/register',
      '/confirm-signup',
      '/forgot_password',
      '/resend_email',
      '/sso-callback',
    ]))
    expect(canonicalRedirects).toEqual(expect.arrayContaining([
      { path: '/', redirect: '/login' },
      { path: '/app', redirect: '/apps' },
      { path: '/apikeys', redirect: '/dashboard/apikeys' },
    ]))
    expect(canonicalRedirects).not.toEqual(expect.arrayContaining([
      { path: '/dashboard', redirect: '/app/home' },
    ]))
  })
})
