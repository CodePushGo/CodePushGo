import { describe, expect, it } from 'vitest'
import { canonicalRedirects } from './routeSurface'

function redirectFor(path: string) {
  const route = canonicalRedirects.find(item => item.path === path)
  if (!route || typeof route.redirect !== 'function')
    throw new Error(`Missing redirect for ${path}`)
  return route.redirect({ params: { package: 'com.example.app' } })
}

describe('[Capgo parity] route surface', () => {
  it('keeps legacy app package URLs as redirects to canonical app routes', () => {
    expect(redirectFor('/p/:package')).toBe('/app/com.example.app')
    expect(redirectFor('/app/p/:package')).toBe('/app/com.example.app')
    expect(redirectFor('/app/p/:package/bundle')).toBe('/app/com.example.app')
    expect(redirectFor('/app/p/:package/bundles')).toBe('/app/com.example.app')
    expect(redirectFor('/app/p/:package/channels')).toBe('/app/com.example.app')
    expect(redirectFor('/app/p/:package/devices')).toBe('/app/com.example.app')
    expect(redirectFor('/app/package/:package/settings')).toBe('/app/com.example.app')
  })
})
