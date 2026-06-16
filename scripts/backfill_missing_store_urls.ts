/*
 * Backfill missing Google Play and Apple App Store links from public.apps.app_id.
 *
 * Dry run:
 *   bun run admin:backfill-missing-store-urls
 */

const APPLE_FALLBACK_COUNTRIES = [
  'gb',
  'ca',
  'au',
  'fr',
  'de',
  'es',
  'it',
  'br',
  'jp',
  'kr',
  'in',
]

export type PlatformFilter = 'android' | 'both' | 'ios'
export type StorePlatform = 'android' | 'ios'

export interface StoreUrlFields {
  android_store_url: string | null
  ios_store_url: string | null
}

export interface AppleLookupResult {
  bundleId?: string
  trackViewUrl?: string
}

export function isMissingStoreUrl(rawUrl: string | null | undefined) {
  return !rawUrl?.trim()
}

export function buildGooglePlayStoreUrl(appId: string) {
  const url = new URL('https://play.google.com/store/apps/details')
  url.searchParams.set('id', appId)
  return url.toString()
}

export function buildAppleLookupUrl(bundleId: string, country: string | null) {
  const url = new URL('https://itunes.apple.com/lookup')
  url.searchParams.set('bundleId', bundleId)
  if (country)
    url.searchParams.set('country', country)
  return url.toString()
}

export function normalizeAppleStoreUrl(rawUrl: string | null | undefined) {
  const trimmed = rawUrl?.trim()
  if (!trimmed)
    return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'apps.apple.com')
      return null
    return url.toString()
  }
  catch {
    return null
  }
}

export function pickAppleLookupStoreUrl(results: AppleLookupResult[] | undefined, bundleId: string) {
  const result = results?.find(item => item.bundleId === bundleId && normalizeAppleStoreUrl(item.trackViewUrl))
  return normalizeAppleStoreUrl(result?.trackViewUrl)
}

export function parsePlatformFilter(rawValue: string | null): PlatformFilter {
  const value = rawValue?.trim().toLowerCase() || 'both'
  if (value === 'android' || value === 'both' || value === 'ios')
    return value
  throw new Error('--platform must be android, ios, or both')
}

export function parseAppleCountries(rawValue: string | null): Array<string | null> {
  const value = rawValue?.trim().toLowerCase() || 'default'
  if (value === 'default')
    return [null]
  if (value === 'all')
    return [null, ...APPLE_FALLBACK_COUNTRIES]

  const countries = value
    .split(',')
    .map(country => country.trim().toLowerCase())
    .filter(Boolean)

  if (countries.length === 0)
    throw new Error('--apple-countries must include at least one country code')

  for (const country of countries) {
    if (!/^[a-z]{2}$/.test(country))
      throw new Error('--apple-countries values must be ISO 3166-1 alpha-2 country codes')
  }

  return Array.from(new Set(countries))
}

function shouldCheckPlatform(platformFilter: PlatformFilter, platform: StorePlatform) {
  return platformFilter === 'both' || platformFilter === platform
}

export function getMissingStoreUrlPlatforms(app: StoreUrlFields, platformFilter: PlatformFilter) {
  const platforms: StorePlatform[] = []
  if (shouldCheckPlatform(platformFilter, 'android') && isMissingStoreUrl(app.android_store_url))
    platforms.push('android')
  if (shouldCheckPlatform(platformFilter, 'ios') && isMissingStoreUrl(app.ios_store_url))
    platforms.push('ios')
  return platforms
}

export async function main() {
  console.log('Missing store URL backfill is not wired to a live client yet. Helper parity is available for scripts and tests.')
}

if (import.meta.main)
  await main()
