import { describe, expect, it } from 'vitest'
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
    expect(resolveDashboardRoute('/app/home')).toBe('console')
  })
})
