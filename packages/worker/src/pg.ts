import type { Context } from 'hono'

interface DatabaseContextEnv {
  HYPERDRIVE_CAPGO_DIRECT_EU?: { connectionString: string }
  MAIN_SUPABASE_DB_URL?: string
  SUPABASE_DB_URL?: string
}

type DatabaseContext = Context<{ Bindings: DatabaseContextEnv }> & {
  res?: Response
  header(name: string, value: string): void
  get(key: string): unknown
  set(key: string, value: unknown): void
}

function fixSupabaseHost(host: string): string {
  if (!host.includes('postgres:postgres@supabase_db_'))
    return host
  const url = URL.parse(host)
  if (!url)
    return host
  url.hostname = url.hostname.split('_')[1] ?? url.hostname
  return url.href
}

function getEnv(c: DatabaseContext, key: keyof DatabaseContextEnv): string {
  const value = c.env[key]
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${key} is required`)
  return value
}

export function safeSetResponseHeader(c: DatabaseContext, name: string, value: string): void {
  try {
    const res = c.res
    if (res?.bodyUsed)
      return
    const body = res?.body as unknown as { locked?: boolean } | null
    if (body?.locked)
      return
  }
  catch {
    return
  }

  try {
    c.header(name, value)
  }
  catch {}
}

function setDatabaseSource(c: DatabaseContext, source: string): void {
  try {
    c.set('databaseSource', source)
  }
  catch {}
  safeSetResponseHeader(c, 'X-Database-Source', source)
}

export function getDatabaseURL(c: DatabaseContext): string {
  if (c.env.HYPERDRIVE_CAPGO_DIRECT_EU?.connectionString) {
    setDatabaseSource(c, 'HYPERDRIVE_CAPGO_DIRECT_EU')
    return c.env.HYPERDRIVE_CAPGO_DIRECT_EU.connectionString
  }

  if (c.env.MAIN_SUPABASE_DB_URL) {
    setDatabaseSource(c, 'sb_pooler_main')
    return c.env.MAIN_SUPABASE_DB_URL
  }

  setDatabaseSource(c, 'direct')
  return fixSupabaseHost(getEnv(c, 'SUPABASE_DB_URL'))
}
