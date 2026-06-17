import type { SupabaseClient } from '@supabase/supabase-js'
import { parseRecoveryParams, type RecoveryParams } from './registration'

export interface SsoCallbackResult {
  status: 'ok'
  redirectTo: string
}

export function validateRedirectPath(path: string | null | undefined, fallback = '/app/home'): string {
  if (!path)
    return fallback

  if (!path.startsWith('/') || path.startsWith('//'))
    return fallback

  if (/^[a-z][a-z0-9+.-]*:/i.test(path))
    return fallback

  return path
}

export function parseSsoCallbackParams(search = window.location.search, hash = window.location.hash): RecoveryParams {
  return parseRecoveryParams(search, hash)
}

export function clearAuthParamsFromUrl(href: string): string {
  const parsedUrl = new URL(href)
  const hashParams = new URLSearchParams(parsedUrl.hash.replace('#', ''))

  parsedUrl.searchParams.delete('access_token')
  parsedUrl.searchParams.delete('refresh_token')
  hashParams.delete('access_token')
  hashParams.delete('refresh_token')

  const nextHash = hashParams.toString()
  parsedUrl.hash = nextHash ? `#${nextHash}` : ''
  return parsedUrl.toString()
}

export async function completeSsoCallback(
  client: SupabaseClient,
  params: RecoveryParams = parseSsoCallbackParams(),
  redirectTo?: string | null,
): Promise<SsoCallbackResult> {
  if (params.error)
    throw new Error(params.errorDescription || params.error)

  if (params.accessToken && params.refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    })
    if (error)
      throw error
  }
  else if (params.code) {
    const { error } = await client.auth.exchangeCodeForSession(params.code)
    if (error)
      throw error
  }
  else {
    throw new Error('No authentication data found')
  }

  return {
    status: 'ok',
    redirectTo: validateRedirectPath(redirectTo),
  }
}
