import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('[Capgo parity] login page surface', () => {
  const source = readFileSync(join(import.meta.dirname, 'LoginView.vue'), 'utf8')
  const shell = readFileSync(join(import.meta.dirname, '../components/auth/AuthPageShell.vue'), 'utf8')

  it('uses the shared Capgo-style auth shell instead of the old split page', () => {
    expect(source).toContain('AuthPageShell')
    expect(source).toContain('card-kicker="Console"')
    expect(source).toContain('hero-title="Ship updates without waiting on the stores"')
    expect(shell).toContain('auth-page-shell')
    expect(shell).toContain('auth-highlight-grid')
  })

  it('keeps the Capgo email-first login flow', () => {
    expect(source).toContain("statusAuth = ref<'email' | 'credentials'>('email')")
    expect(source).toContain('data-test="login-email-step"')
    expect(source).toContain('data-test="login-password-step"')
    expect(source).toContain('handleEmailContinue')
    expect(source).toContain('goBackToEmail')
    expect(source).toContain('signInWithSSO')
  })
})
