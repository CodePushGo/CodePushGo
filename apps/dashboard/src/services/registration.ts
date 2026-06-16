import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const planIntentStorageKey = 'codepushgo:plan-intent'

export interface RegistrationConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  consoleUrl: string
  enabled: boolean
}

export interface PlanIntent {
  plan: string
  billingPeriod: 'monthly' | 'yearly'
  priceId: string | null
  source: string
}

export interface SignupInput {
  email: string
  password: string
  firstName: string
  lastName: string
  intent: PlanIntent
  captchaToken?: string
}

export interface PlanIntentPayload {
  email: string
  user_id: string | null
  plan: string
  billing_period: string
  price_id: string | null
  source: string
  first_name: string
  last_name: string
  metadata: Record<string, unknown>
}

interface SupabaseEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
  VITE_SUPABASE_PROJECT_REF?: string
  VITE_CONSOLE_URL?: string
}

const allowedBillingPeriods = new Set(['monthly', 'yearly'])

export function getRegistrationConfig(env: Partial<SupabaseEnv> = import.meta.env as Partial<SupabaseEnv>): RegistrationConfig {
  const projectRef = env.VITE_SUPABASE_PROJECT_REF || 'umpxowxnwroafuzynvwf'
  const supabaseUrl = env.VITE_SUPABASE_URL || `https://${projectRef}.supabase.co`
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || ''
  return {
    supabaseUrl,
    supabaseAnonKey,
    consoleUrl: env.VITE_CONSOLE_URL || 'https://console.codepushgo.com',
    enabled: Boolean(supabaseUrl && supabaseAnonKey),
  }
}

export function createRegistrationClient(config = getRegistrationConfig()) {
  if (!config.enabled)
    return null
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

export function normalizePlanIntent(params: URLSearchParams, fallback?: PlanIntent | null): PlanIntent {
  const plan = params.get('plan') || params.get('product') || fallback?.plan || 'trial'
  const billing = params.get('billing') || params.get('interval') || fallback?.billingPeriod || 'monthly'
  return {
    plan: plan.trim().toLowerCase() || 'trial',
    billingPeriod: allowedBillingPeriods.has(billing) ? billing as 'monthly' | 'yearly' : 'monthly',
    priceId: params.get('price_id') || params.get('priceId') || fallback?.priceId || null,
    source: params.get('source') || fallback?.source || 'register',
  }
}

export function readStoredPlanIntent(storage: Storage = window.localStorage): PlanIntent | null {
  try {
    const raw = storage.getItem(planIntentStorageKey)
    if (!raw)
      return null
    const parsed = JSON.parse(raw) as Partial<PlanIntent>
    if (!parsed.plan)
      return null
    return normalizePlanIntent(new URLSearchParams({
      plan: parsed.plan,
      billing: parsed.billingPeriod || 'monthly',
      ...(parsed.priceId ? { price_id: parsed.priceId } : {}),
      source: parsed.source || 'register',
    }))
  }
  catch {
    return null
  }
}

export function persistPlanIntent(intent: PlanIntent, storage: Storage = window.localStorage) {
  storage.setItem(planIntentStorageKey, JSON.stringify(intent))
}

export function buildPlanIntentPayload(input: SignupInput, userId: string | null): PlanIntentPayload {
  return {
    email: input.email.trim().toLowerCase(),
    user_id: userId,
    plan: input.intent.plan,
    billing_period: input.intent.billingPeriod,
    price_id: input.intent.priceId,
    source: input.intent.source,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    metadata: {
      path: window.location.pathname,
      query: window.location.search,
      referrer: document.referrer || null,
    },
  }
}

export async function recordPlanIntent(client: SupabaseClient, payload: PlanIntentPayload) {
  const { data, error } = await client
    .from('plan_intents')
    .insert(payload)
    .select('id')
    .maybeSingle()

  if (error)
    throw error
  return data?.id as string | undefined
}

export async function registerWithPlanIntent(client: SupabaseClient, input: SignupInput) {
  const { data, error } = await client.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      captchaToken: input.captchaToken,
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      },
    },
  })

  if (error)
    throw error

  const sessionUserId = data.session?.user.id ?? null
  const intentId = await recordPlanIntent(client, buildPlanIntentPayload(input, sessionUserId))
  return { ...data, intentId }
}
