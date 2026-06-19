import { describe, expect, it, vi } from 'vitest'
import {
  bootstrapAuthSession,
  completePasswordReset,
  createAppOnboarding,
  createOrganizationOnboarding,
  createRegistrationClient,
  getCaptchaTokenFromParams,
  getRegistrationConfig,
  loginAccount,
  normalizeBillingPeriod,
  normalizePlan,
  normalizeRelativeReturnTo,
  parseRecoveryParams,
  recordPlanIntent,
  registerAccount,
  requestPasswordReset,
  resendSignupEmail,
  verifyLoginMfa,
} from './registration'

const testConfig = {
  supabaseUrl: 'https://umpxowxnwroafuzynvwf.supabase.co',
  supabaseAnonKey: 'publishable',
  consoleUrl: 'https://console.codepushgo.com/',
  apiUrl: 'https://api.codepushgo.com',
  enabled: true,
}

describe('registration config', () => {
  it('derives the Supabase URL from the CodePushGo project ref', () => {
    expect(getRegistrationConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable' })).toMatchObject({
      supabaseUrl: 'https://umpxowxnwroafuzynvwf.supabase.co',
      supabaseAnonKey: 'publishable',
      enabled: true,
    })
  })

  it('uses the CodePushGo publishable key by default', () => {
    expect(getRegistrationConfig({ VITE_SUPABASE_PROJECT_REF: 'abc' }).enabled).toBe(true)
  })
})

describe('registration Supabase client', () => {
  it('reuses the same Supabase client for the same public config', () => {
    const config = getRegistrationConfig({ VITE_SUPABASE_PROJECT_REF: 'umpxowxnwroafuzynvwf' })

    expect(createRegistrationClient(config)).toBe(createRegistrationClient(config))
  })
})

describe('createConfirmedAccount', () => {
  it('creates an account through the Worker signup endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
    vi.stubGlobal('fetch', fetchMock)

    const { createConfirmedAccount } = await import('./registration')
    await createConfirmedAccount({
      email: ' User@Example.com ',
      password: 'password123',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
    }, { ...testConfig, apiUrl: 'https://api.test/' })

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/auth/signup', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'password123',
        first_name: 'Ada',
        last_name: 'Lovelace',
      }),
    }))
    vi.unstubAllGlobals()
  })

  it('passes captcha tokens through the Worker signup endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
    vi.stubGlobal('fetch', fetchMock)

    const { createConfirmedAccount } = await import('./registration')
    await createConfirmedAccount({
      email: 'user@example.com',
      password: 'password123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      captchaToken: 'captcha-token',
    }, { ...testConfig, apiUrl: 'https://api.test/' })

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/auth/signup', expect.objectContaining({
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'password123',
        first_name: 'Ada',
        last_name: 'Lovelace',
        captcha_token: 'captcha-token',
      }),
    }))
    vi.unstubAllGlobals()
  })
})

describe('registerAccount', () => {
  it('signs up without storing plan metadata at registration time', async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: 'user_123' } }, error: null })
    const client = { auth: { signUp } }

    await registerAccount(client as any, {
      email: ' User@Example.com ',
      password: 'password123',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
    })

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
      password: 'password123',
      options: expect.objectContaining({
        data: {
          first_name: 'Ada',
          last_name: 'Lovelace',
        },
      }),
    }))
    expect(signUp.mock.calls[0][0].options.data).not.toHaveProperty('plan')
  })

  it('returns the Supabase session from signup so the UI can redirect immediately', async () => {
    const session = { access_token: 'access', refresh_token: 'refresh' }
    const signUp = vi.fn().mockResolvedValue({ data: { session, user: { id: 'user_123' } }, error: null })
    const client = { auth: { signUp } }

    await expect(registerAccount(client as any, {
      email: 'user@example.com',
      password: 'password123',
      firstName: 'Ada',
      lastName: 'Lovelace',
    })).resolves.toMatchObject({ session })
  })
})

describe('login MFA flow', () => {
  it('returns ok when password login produces a session', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    const client = { auth: { signInWithPassword } }

    await expect(loginAccount(client as any, { email: ' User@Example.com ', password: 'password123' })).resolves.toEqual({ status: 'ok' })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password123' })
  })

  it('challenges the first verified MFA factor when AAL2 is required', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    const getAuthenticatorAssuranceLevel = vi.fn().mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    const listFactors = vi.fn().mockResolvedValue({ data: { all: [{ id: 'factor_1', status: 'verified' }] }, error: null })
    const challenge = vi.fn().mockResolvedValue({ data: { id: 'challenge_1' }, error: null })
    const client = { auth: { signInWithPassword, mfa: { getAuthenticatorAssuranceLevel, listFactors, challenge } } }

    await expect(loginAccount(client as any, { email: 'user@example.com', password: 'password123' })).resolves.toEqual({
      status: 'mfa_required',
      factorId: 'factor_1',
      challengeId: 'challenge_1',
    })
    expect(challenge).toHaveBeenCalledWith({ factorId: 'factor_1' })
  })

  it('verifies MFA codes through Supabase', async () => {
    const verify = vi.fn().mockResolvedValue({ data: {}, error: null })
    const client = { auth: { mfa: { verify } } }

    await expect(verifyLoginMfa(client as any, { factorId: 'factor_1', challengeId: 'challenge_1', code: '123456' })).resolves.toEqual({ status: 'ok' })
    expect(verify).toHaveBeenCalledWith({ factorId: 'factor_1', challengeId: 'challenge_1', code: '123456' })
  })
})

describe('login auth bootstrap', () => {
  it('sets a session from hash tokens and exchanges query codes', async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null })
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null })
    const client = { auth: { setSession, exchangeCodeForSession } }

    await expect(bootstrapAuthSession(client as any, {
      accessToken: 'access',
      refreshToken: 'refresh',
      code: '',
      error: '',
      errorDescription: '',
    })).resolves.toBe(true)
    expect(setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' })

    await expect(bootstrapAuthSession(client as any, {
      accessToken: '',
      refreshToken: '',
      code: 'code-123',
      error: '',
      errorDescription: '',
    })).resolves.toBe(true)
    expect(exchangeCodeForSession).toHaveBeenCalledWith('code-123')
  })
})

describe('forgot password flow', () => {
  it('requests a Supabase password reset with the console step two redirect', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null })
    const client = { auth: { resetPasswordForEmail } }

    await requestPasswordReset(client as any, ' User@Example.com ', testConfig, 'captcha-token')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://console.codepushgo.com/forgot_password?step=2',
      captchaToken: 'captcha-token',
    })
  })

  it('parses recovery params from both query and hash values', () => {
    expect(parseRecoveryParams('?code=abc', '#access_token=access&refresh_token=refresh')).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      code: 'abc',
      error: '',
      errorDescription: '',
    })
    expect(parseRecoveryParams('?error=bad&error_description=Expired', '')).toMatchObject({
      error: 'bad',
      errorDescription: 'Expired',
    })
  })

  it('completes hash-token password recovery, resets MFA when supported, and signs out other sessions', async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null })
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null })
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const listFactors = vi.fn().mockResolvedValue({ data: { all: [{ id: 'factor_1' }] }, error: null })
    const unenroll = vi.fn().mockResolvedValue({ error: null })
    const client = { auth: { setSession, exchangeCodeForSession, updateUser, signOut, mfa: { listFactors, unenroll } } }

    await expect(completePasswordReset(client as any, 'new-password', {
      accessToken: 'access',
      refreshToken: 'refresh',
      code: '',
      error: '',
      errorDescription: '',
    })).resolves.toEqual({ status: 'ok' })

    expect(setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' })
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'factor_1' })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  it('completes code-based password recovery when tokens are absent', async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null })
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null })
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const client = { auth: { setSession, exchangeCodeForSession, updateUser, signOut } }

    await completePasswordReset(client as any, 'new-password', {
      accessToken: '',
      refreshToken: '',
      code: 'code-123',
      error: '',
      errorDescription: '',
    })

    expect(setSession).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).toHaveBeenCalledWith('code-123')
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
  })
})

describe('resend signup email flow', () => {
  it('uses Supabase signup resend with the normalized email and return path', async () => {
    const resend = vi.fn().mockResolvedValue({ data: {}, error: null })
    const client = { auth: { resend } }

    await resendSignupEmail(client as any, ' User@Example.com ', {
      config: testConfig,
      captchaToken: 'captcha-token',
      returnTo: '/settings/account',
    })

    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'user@example.com',
      options: {
        emailRedirectTo: 'https://console.codepushgo.com/onboarding/verify_email?return_to=%2Fsettings%2Faccount',
        captchaToken: 'captcha-token',
      },
    })
  })

  it('normalizes unsafe return paths and reads captcha tokens from callback params', () => {
    expect(normalizeRelativeReturnTo('/app/home')).toBe('/app/home')
    expect(normalizeRelativeReturnTo('https://evil.test')).toBe('/login')
    expect(normalizeRelativeReturnTo('//evil.test')).toBe('/login')
    expect(getCaptchaTokenFromParams('?captcha_token=query-token', '')).toBe('query-token')
    expect(getCaptchaTokenFromParams('', '#turnstile_token=hash-token')).toBe('hash-token')
  })
})

describe('console onboarding plan intent', () => {
  it('normalizes plan and billing inputs', () => {
    expect(normalizePlan('Team')).toBe('team')
    expect(normalizePlan('bad value')).toBe('trial')
    expect(normalizeBillingPeriod('yearly')).toBe('yearly')
    expect(normalizeBillingPeriod('monthly')).toBe('monthly')
  })

  it('records plan intent for the authenticated user', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'intent_1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const client = { from: vi.fn(() => ({ insert })) }
    const user = { id: 'user_123' }

    await recordPlanIntent(client as any, user as any, {
      email: ' User@Example.com ',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      plan: 'Team',
      billingPeriod: 'yearly',
      source: 'console_onboarding',
    })

    expect(client.from).toHaveBeenCalledWith('plan_intents')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user_123',
      email: 'user@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      plan: 'team',
      billing_period: 'yearly',
      source: 'console_onboarding',
    }))
  })
})

describe('organization onboarding', () => {
  it('creates the organization through the Capgo-style onboarding RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'org_1', name: 'Acme' }], error: null })
    const client = { rpc }

    await expect(createOrganizationOnboarding(client as any, {
      name: ' Acme ',
      plan: 'Team',
      billingPeriod: 'yearly',
      metadata: { source: 'test' },
    })).resolves.toEqual({ id: 'org_1', name: 'Acme' })

    expect(rpc).toHaveBeenCalledWith('create_organization_onboarding', {
      p_name: 'Acme',
      p_plan: 'team',
      p_billing_period: 'yearly',
      p_metadata: { source: 'test' },
    })
  })

  it('throws the Supabase RPC error when organization onboarding fails', async () => {
    const rpcError = new Error('rpc denied')
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: rpcError }) }

    await expect(createOrganizationOnboarding(client as any, {
      name: 'Acme',
      plan: 'team',
      billingPeriod: 'monthly',
      metadata: {},
    })).rejects.toThrow('rpc denied')
  })

  it('throws when organization onboarding RPC returns no row', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }

    await expect(createOrganizationOnboarding(client as any, {
      name: 'Acme',
      plan: 'team',
      billingPeriod: 'monthly',
      metadata: {},
    })).rejects.toThrow('Organization was not created')
  })
})

describe('app onboarding', () => {
  it('creates an app through the Capgo-style onboarding RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ app_id: 'com.test.app', name: 'Test app', owner_org: 'org_1' }], error: null })
    const client = { rpc }

    await expect(createAppOnboarding(client as any, {
      appId: ' com.test.app ',
      name: ' Test app ',
      ownerOrg: ' org_1 ',
    })).resolves.toMatchObject({ app_id: 'com.test.app', name: 'Test app' })

    expect(rpc).toHaveBeenCalledWith('create_app_onboarding', {
      p_app_id: 'com.test.app',
      p_name: 'Test app',
      p_owner_org: 'org_1',
    })
  })

  it('throws when app onboarding RPC returns no row', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
    await expect(createAppOnboarding(client as any, { appId: 'com.test.app', name: 'Test app', ownerOrg: 'org_1' })).rejects.toThrow('App was not created')
  })
})
