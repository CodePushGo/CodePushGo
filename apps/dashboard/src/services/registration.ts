import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'

export interface RegistrationConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  consoleUrl: string
  apiUrl: string
  enabled: boolean
}

export interface SignupInput {
  email: string
  password: string
  firstName: string
  lastName: string
  captchaToken?: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface PlanIntentInput {
  email: string
  firstName?: string
  lastName?: string
  plan: string
  billingPeriod: 'monthly' | 'yearly'
  priceId?: string
  source?: string
  metadata?: Record<string, unknown>
}

export interface ConsoleAppRecord {
  app_id: string
  name: string
  owner_org?: string | null
  created_at?: string
  need_onboarding?: boolean
}

export interface ConsoleReleaseRecord {
  app_id: string
  version: string
  platform: 'ios' | 'android'
  channel: string
  size?: number | null
  mandatory?: boolean | null
  rollout?: number | null
  notes?: string | null
  created_at?: string
}

const CODEPUSHGO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__EBHKsRnL--XAzmI7NWRww_q531-pQO'

interface SupabaseEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_ANON_KEY?: string
  VITE_SUPABASE_PROJECT_REF?: string
  VITE_CONSOLE_URL?: string
  VITE_API_URL?: string
}

export function getRegistrationConfig(env: Partial<SupabaseEnv> = import.meta.env as Partial<SupabaseEnv>): RegistrationConfig {
  const projectRef = env.VITE_SUPABASE_PROJECT_REF || 'umpxowxnwroafuzynvwf'
  const supabaseUrl = env.VITE_SUPABASE_URL || `https://${projectRef}.supabase.co`
  const supabaseAnonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || CODEPUSHGO_SUPABASE_PUBLISHABLE_KEY
  return {
    supabaseUrl,
    supabaseAnonKey,
    consoleUrl: env.VITE_CONSOLE_URL || 'https://console.codepushgo.com',
    apiUrl: env.VITE_API_URL || 'https://api.codepushgo.com',
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
      detectSessionInUrl: true,
    },
  })
}
export async function createConfirmedAccount(input: SignupInput, config = getRegistrationConfig()) {
  const response = await fetch(`${config.apiUrl.replace(/\/+$/, '')}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
    }),
  })
  const data = await response.json().catch(() => ({})) as { message?: string }
  if (!response.ok)
    throw new Error(data.message || 'Unable to create account')
  return data
}


export const createDashboardClient = createRegistrationClient

export async function registerAccount(client: SupabaseClient, input: SignupInput) {
  const config = getRegistrationConfig()
  const { data, error } = await client.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      captchaToken: input.captchaToken,
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      },
      emailRedirectTo: `${config.consoleUrl.replace(/\/+$/, '')}/onboarding/verify_email`,
    },
  })

  if (error)
    throw error

  return data
}

export async function loginAccount(client: SupabaseClient, input: LoginInput) {
  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })
  if (error)
    throw error
  return data
}

export async function getCurrentSession(client: SupabaseClient): Promise<Session | null> {
  const { data, error } = await client.auth.getSession()
  if (error)
    throw error
  return data.session
}

export async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser()
  if (error)
    throw error
  return data.user
}

export async function listUserApps(client: SupabaseClient): Promise<ConsoleAppRecord[]> {
  const { data, error } = await client
    .from('apps')
    .select('app_id,name,owner_org,created_at,need_onboarding')
    .order('created_at', { ascending: false })

  if (error)
    throw error

  return (data ?? []) as ConsoleAppRecord[]
}

export async function listAppReleases(client: SupabaseClient, appId: string): Promise<ConsoleReleaseRecord[]> {
  const { data, error } = await client
    .from('releases')
    .select('app_id,version,platform,channel,size,mandatory,rollout,notes,created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error)
    throw error

  return (data ?? []) as ConsoleReleaseRecord[]
}

export function normalizePlan(value: string | null | undefined) {
  const plan = (value || 'trial').trim().toLowerCase()
  return /^[a-z0-9_-]+$/.test(plan) ? plan : 'trial'
}

export function normalizeBillingPeriod(value: string | null | undefined): 'monthly' | 'yearly' {
  return value === 'yearly' || value === 'y' ? 'yearly' : 'monthly'
}

export async function recordPlanIntent(client: SupabaseClient, user: User, input: PlanIntentInput) {
  const { data, error } = await client
    .from('plan_intents')
    .insert({
      user_id: user.id,
      email: input.email.trim().toLowerCase(),
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      plan: normalizePlan(input.plan),
      billing_period: input.billingPeriod,
      price_id: input.priceId?.trim() || null,
      source: input.source || 'console_onboarding',
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single()

  if (error)
    throw error

  return data
}
