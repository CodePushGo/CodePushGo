import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearWebsitePaidUserCookie, syncWebsitePaidUserCookieFromOrganizations } from './websiteAuthCookie'

const localConfig = vi.hoisted(() => ({
  value: {
    host: 'https://console.codepushgo.com',
    hostWeb: 'https://codepushgo.com' as string | undefined,
  },
}))

vi.mock('./supabase', () => ({
  getLocalConfig: () => localConfig.value,
}))

describe('[Capgo parity] website paid user cookie', () => {
  let cookieWrites: string[]
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location')

  beforeEach(() => {
    localConfig.value = {
      host: 'https://console.codepushgo.com',
      hostWeb: 'https://codepushgo.com',
    }
    cookieWrites = []
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get cookie() {
          return ''
        },
        set cookie(value: string) {
          cookieWrites.push(value)
        },
      },
    })
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        hostname: 'console.codepushgo.com',
        protocol: 'https:',
      },
    })
  })

  afterEach(() => {
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument)
    else
      delete (globalThis as { document?: unknown }).document
    if (originalLocation)
      Object.defineProperty(globalThis, 'location', originalLocation)
    else
      delete (globalThis as { location?: unknown }).location
  })

  it('sets a 30 day cookie for paid non-invite organizations', () => {
    syncWebsitePaidUserCookieFromOrganizations([
      { paying: false, role: 'owner' },
      { paying: true, role: 'read' },
    ])

    expect(cookieWrites).toContain('codepushgo_paid_user=1; Path=/; Max-Age=2592000; SameSite=Lax; Domain=.codepushgo.com; Secure')
  })

  it('falls back to the console host when the landing URL is not configured', () => {
    localConfig.value = {
      host: 'https://console.codepushgo.com',
      hostWeb: undefined,
    }

    syncWebsitePaidUserCookieFromOrganizations([
      { paying: true, role: 'owner' },
    ])

    expect(cookieWrites).toContain('codepushgo_paid_user=1; Path=/; Max-Age=2592000; SameSite=Lax; Domain=.codepushgo.com; Secure')
  })

  it('clears the cookie when paid access is only from an invite', () => {
    syncWebsitePaidUserCookieFromOrganizations([
      { paying: true, role: 'invite_read' },
    ])

    expect(cookieWrites).toContain('codepushgo_paid_user=; Path=/; Max-Age=0; SameSite=Lax; Domain=.codepushgo.com; Secure')
    expect(cookieWrites).toContain('codepushgo_paid_user=; Path=/; Max-Age=0; SameSite=Lax; Secure')
  })

  it('clears the paid user cookie', () => {
    clearWebsitePaidUserCookie()

    expect(cookieWrites).toContain('codepushgo_paid_user=; Path=/; Max-Age=0; SameSite=Lax; Domain=.codepushgo.com; Secure')
    expect(cookieWrites).toContain('codepushgo_paid_user=; Path=/; Max-Age=0; SameSite=Lax; Secure')
  })
})
