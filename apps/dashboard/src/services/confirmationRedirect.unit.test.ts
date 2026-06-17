import { describe, expect, it } from 'vitest'
import { resolveConfirmationRedirect } from './confirmationRedirect'

const config = {
  consoleUrl: 'https://console.codepushgo.com',
  supabaseUrl: 'https://umpxowxnwroafuzynvwf.supabase.co',
  origin: 'https://console.codepushgo.com',
}

describe('[Capgo parity] confirmation redirect', () => {
  it('allows encoded Supabase confirmation URLs', () => {
    const target = encodeURIComponent('https://umpxowxnwroafuzynvwf.supabase.co/auth/v1/verify?token=abc&type=signup')

    expect(resolveConfirmationRedirect(target, config)).toEqual({
      ok: true,
      url: 'https://umpxowxnwroafuzynvwf.supabase.co/auth/v1/verify?token=abc&type=signup',
    })
  })

  it('allows console-host confirmation URLs', () => {
    expect(resolveConfirmationRedirect('/onboarding/verify_email?code=abc', config)).toEqual({
      ok: true,
      url: 'https://console.codepushgo.com/onboarding/verify_email?code=abc',
    })
  })

  it('rejects non-https and external hosts outside dev', () => {
    expect(resolveConfirmationRedirect('http://console.codepushgo.com/verify', config)).toMatchObject({ ok: false })
    expect(resolveConfirmationRedirect('https://evil.example/verify', config)).toMatchObject({ ok: false })
  })

  it('allows localhost only in dev mode', () => {
    expect(resolveConfirmationRedirect('http://localhost:5173/verify', { ...config, dev: true })).toMatchObject({ ok: true })
    expect(resolveConfirmationRedirect('http://localhost:5173/verify', config)).toMatchObject({ ok: false })
  })
})
