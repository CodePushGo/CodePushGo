import { getLocalConfig } from './supabase'

export interface WebsitePaidOrganization {
  paying?: boolean | null
  role?: string | null
}

const cookieName = 'codepushgo_paid_user'
const paidCookieMaxAgeSeconds = 30 * 24 * 60 * 60

function isBrowser() {
  return typeof document !== 'undefined' && typeof location !== 'undefined'
}

function rootDomainFromHost(host: string | undefined) {
  if (!host)
    return undefined
  try {
    const parsed = new URL(host)
    const parts = parsed.hostname.split('.').filter(Boolean)
    if (parts.length < 2)
      return undefined
    return `.${parts.slice(-2).join('.')}`
  }
  catch {
    return undefined
  }
}

function cookieDomain() {
  const config = getLocalConfig()
  return rootDomainFromHost(config.hostWeb) ?? rootDomainFromHost(config.host)
}

function writePaidCookie(value: string, maxAge: number, includeDomain: boolean) {
  if (!isBrowser())
    return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  const domain = includeDomain ? cookieDomain() : undefined
  document.cookie = `${cookieName}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domain ? `; Domain=${domain}` : ''}${secure}`
}

function hasPaidNonInviteOrganization(organizations: WebsitePaidOrganization[]) {
  return organizations.some(org => org.paying === true && !org.role?.startsWith('invite_'))
}

export function clearWebsitePaidUserCookie() {
  writePaidCookie('', 0, true)
  writePaidCookie('', 0, false)
}

export function syncWebsitePaidUserCookieFromOrganizations(organizations: WebsitePaidOrganization[]) {
  if (hasPaidNonInviteOrganization(organizations)) {
    writePaidCookie('1', paidCookieMaxAgeSeconds, true)
    return
  }
  clearWebsitePaidUserCookie()
}
