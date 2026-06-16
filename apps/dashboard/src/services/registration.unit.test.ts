import { describe, expect, it, vi } from 'vitest'
import {
  getRegistrationConfig,
  normalizeBillingPeriod,
  normalizePlan,
  recordPlanIntent,
  registerAccount,
} from './registration'

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
    }, { supabaseUrl: '', supabaseAnonKey: '', consoleUrl: '', apiUrl: 'https://api.test/', enabled: true })

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
