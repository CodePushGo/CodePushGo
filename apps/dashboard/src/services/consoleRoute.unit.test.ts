import { describe, expect, it } from 'vitest'
import { appHref, appIdFromPath, consoleSectionTitle, pathSection } from './consoleRoute'

describe('[Capgo parity] console route helpers', () => {
  it('maps console paths to sections', () => {
    expect(pathSection('/')).toBe('home')
    expect(pathSection('/apps')).toBe('home')
    expect(pathSection('/app/home')).toBe('home')
    expect(pathSection('/dashboard/apikeys')).toBe('api-keys')
    expect(pathSection('/dashboard/settings/plans')).toBe('settings')
    expect(pathSection('/app/p/com.test.app/bundle')).toBe('releases')
    expect(pathSection('/app/p/com.test.app/channels')).toBe('channels')
    expect(pathSection('/app/p/com.test.app/devices')).toBe('devices')
    expect(pathSection('/app/p/com.test.app/stats')).toBe('stats')
    expect(pathSection('/app/p/com.test.app')).toBe('overview')
  })

  it('extracts and builds app URLs with encoded native bundle IDs', () => {
    expect(appIdFromPath('/app/p/com.example.app')).toBe('com.example.app')
    expect(appIdFromPath('/app/p/com.example%2Fapp/bundle')).toBe('com.example/app')
    expect(appIdFromPath('/app/home')).toBe('')
    expect(appHref('com.example/app', 'releases')).toBe('/app/p/com.example%2Fapp/bundle')
    expect(appHref('com.example.app', 'channels')).toBe('/app/p/com.example.app/channels')
    expect(appHref('com.example.app')).toBe('/app/p/com.example.app')
  })

  it('keeps section titles centralized for the shell', () => {
    expect(consoleSectionTitle('home')).toBe('Dashboard')
    expect(consoleSectionTitle('releases')).toBe('Bundles')
    expect(consoleSectionTitle('settings')).toBe('Settings')
    expect(consoleSectionTitle('settings', true)).toBe('Onboarding')
  })
})
