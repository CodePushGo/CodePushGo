import { describe, expect, it, vi } from 'vitest'
import { clearAuthParamsFromUrl, completeSsoCallback, parseSsoCallbackParams, validateRedirectPath } from './ssoCallback'

describe('[Capgo parity] SSO callback auth flow', () => {
  it('accepts only relative redirect paths', () => {
    expect(validateRedirectPath('/app/home')).toBe('/app/home')
    expect(validateRedirectPath('/app/home?org=org_1')).toBe('/app/home?org=org_1')
    expect(validateRedirectPath(undefined)).toBe('/app/home')
    expect(validateRedirectPath('app/home')).toBe('/app/home')
    expect(validateRedirectPath('//evil.test')).toBe('/app/home')
    expect(validateRedirectPath('https://evil.test')).toBe('/app/home')
    expect(validateRedirectPath('javascript:alert(1)')).toBe('/app/home')
  })

  it('parses token, code, and error params from query and hash values', () => {
    expect(parseSsoCallbackParams('?code=code-123', '#access_token=access&refresh_token=refresh')).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      code: 'code-123',
      error: '',
      errorDescription: '',
    })

    expect(parseSsoCallbackParams('?error=bad&error_description=Denied', '')).toMatchObject({
      error: 'bad',
      errorDescription: 'Denied',
    })
  })

  it('clears auth tokens from query and hash without dropping other callback params', () => {
    expect(clearAuthParamsFromUrl('https://console.codepushgo.com/sso-callback?access_token=a&refresh_token=r&code=c#access_token=ha&refresh_token=hr&next=%2Fapp%2Fhome')).toBe('https://console.codepushgo.com/sso-callback?code=c#next=%2Fapp%2Fhome')
  })

  it('keeps non-auth linked callback params for the view handoff', () => {
    expect(clearAuthParamsFromUrl('https://console.codepushgo.com/sso-callback?sso_linked=true&access_token=a#refresh_token=r')).toBe('https://console.codepushgo.com/sso-callback?sso_linked=true')
  })

  it('sets a Supabase session from hash tokens', async () => {
    const setSession = vi.fn().mockResolvedValue({ data: { session: {} }, error: null })
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { session: {} }, error: null })
    const client = { auth: { setSession, exchangeCodeForSession } }

    await expect(completeSsoCallback(client as any, {
      accessToken: 'access',
      refreshToken: 'refresh',
      code: '',
      error: '',
      errorDescription: '',
    }, '/app/home')).resolves.toEqual({ status: 'ok', redirectTo: '/app/home' })

    expect(setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' })
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('exchanges a code when tokens are absent', async () => {
    const setSession = vi.fn().mockResolvedValue({ data: { session: {} }, error: null })
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { session: {} }, error: null })
    const client = { auth: { setSession, exchangeCodeForSession } }

    await expect(completeSsoCallback(client as any, {
      accessToken: '',
      refreshToken: '',
      code: 'code-123',
      error: '',
      errorDescription: '',
    }, '//evil.test')).resolves.toEqual({ status: 'ok', redirectTo: '/app/home' })

    expect(setSession).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).toHaveBeenCalledWith('code-123')
  })

  it('surfaces callback errors and rejects empty callbacks', async () => {
    const client = { auth: { setSession: vi.fn(), exchangeCodeForSession: vi.fn() } }

    await expect(completeSsoCallback(client as any, {
      accessToken: '',
      refreshToken: '',
      code: '',
      error: 'access_denied',
      errorDescription: 'Denied',
    })).rejects.toThrow('Denied')

    await expect(completeSsoCallback(client as any, {
      accessToken: '',
      refreshToken: '',
      code: '',
      error: '',
      errorDescription: '',
    })).rejects.toThrow('No authentication data found')
  })
})
