import { describe, expect, it, vi } from 'vitest'
import {
  buildPlanIntentPayload,
  getRegistrationConfig,
  normalizePlanIntent,
  persistPlanIntent,
  planIntentStorageKey,
  readStoredPlanIntent,
} from './registration'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  }
}

describe('registration config', () => {
  it('derives the Supabase URL from the CodePushGo project ref', () => {
    expect(getRegistrationConfig({ VITE_SUPABASE_ANON_KEY: 'anon' })).toMatchObject({
      supabaseUrl: 'https://umpxowxnwroafuzynvwf.supabase.co',
      supabaseAnonKey: 'anon',
      enabled: true,
    })
  })

  it('stays disabled until the anon key is provided', () => {
    expect(getRegistrationConfig({ VITE_SUPABASE_PROJECT_REF: 'abc' }).enabled).toBe(false)
  })
})

describe('plan intent', () => {
  it('normalizes plan, billing, price, and source from the URL', () => {
    const intent = normalizePlanIntent(new URLSearchParams('plan=Team&billing=yearly&price_id=price_123&source=pricing'))

    expect(intent).toEqual({
      plan: 'team',
      billingPeriod: 'yearly',
      priceId: 'price_123',
      source: 'pricing',
    })
  })

  it('persists and reads the selected plan intent', () => {
    const storage = memoryStorage()
    const intent = normalizePlanIntent(new URLSearchParams('plan=solo&interval=monthly'))

    persistPlanIntent(intent, storage)

    expect(storage.getItem(planIntentStorageKey)).toContain('solo')
    expect(readStoredPlanIntent(storage)).toEqual(intent)
  })

  it('builds a Supabase row without storing the plan in auth metadata', () => {
    vi.stubGlobal('window', { location: { pathname: '/register', search: '?plan=team' } })
    vi.stubGlobal('document', { referrer: 'https://codepushgo.com/pricing' })

    const payload = buildPlanIntentPayload({
      email: ' User@Example.com ',
      password: 'password123',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      intent: normalizePlanIntent(new URLSearchParams('plan=team&billing=yearly')),
    }, 'user_123')

    expect(payload).toMatchObject({
      email: 'user@example.com',
      user_id: 'user_123',
      first_name: 'Ada',
      last_name: 'Lovelace',
      plan: 'team',
      billing_period: 'yearly',
      source: 'register',
    })
    expect(payload.metadata).toEqual({
      path: '/register',
      query: '?plan=team',
      referrer: 'https://codepushgo.com/pricing',
    })
  })
})
