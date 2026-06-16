import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBuilderConfig } from '../src/config-builder'

beforeEach(() => {
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', '')
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', '')
  vi.stubEnv('GOOGLE_OAUTH_SCOPES', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function get(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env))
    vi.stubEnv(key, value)
  return getBuilderConfig()
}

describe('[Capgo parity] get /private/config/builder', () => {
  it('returns enabled:true with clientId, clientSecret, and default scopes when both required env vars are set', () => {
    expect(get({
      GOOGLE_OAUTH_CLIENT_ID: '1234.apps.googleusercontent.com',
      GOOGLE_OAUTH_CLIENT_SECRET: 'GOCSPX-abc',
    })).toEqual({
      enabled: true,
      clientId: '1234.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-abc',
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    })
  })

  it('returns enabled:false with no other fields when neither required env var is set', () => {
    expect(get({})).toEqual({ enabled: false })
  })

  it('returns enabled:false when only GOOGLE_OAUTH_CLIENT_ID is set', () => {
    expect(get({ GOOGLE_OAUTH_CLIENT_ID: '1234.apps.googleusercontent.com' })).toEqual({ enabled: false })
  })

  it('returns enabled:false when only GOOGLE_OAUTH_CLIENT_SECRET is set', () => {
    expect(get({ GOOGLE_OAUTH_CLIENT_SECRET: 'GOCSPX-abc' })).toEqual({ enabled: false })
  })

  it('treats whitespace-only env vars the same as missing', () => {
    expect(get({ GOOGLE_OAUTH_CLIENT_ID: '   ', GOOGLE_OAUTH_CLIENT_SECRET: '\t\n' })).toEqual({ enabled: false })
  })

  it('returns a custom single scope when GOOGLE_OAUTH_SCOPES is set to one value', () => {
    const body = get({
      GOOGLE_OAUTH_CLIENT_ID: 'cid',
      GOOGLE_OAUTH_CLIENT_SECRET: 'csec',
      GOOGLE_OAUTH_SCOPES: 'https://www.googleapis.com/auth/cloud-platform',
    })

    expect(body).toMatchObject({ enabled: true })
    if (body.enabled)
      expect(body.scopes).toEqual(['https://www.googleapis.com/auth/cloud-platform'])
  })

  it('parses comma-separated scopes and trims whitespace around each entry', () => {
    const body = get({
      GOOGLE_OAUTH_CLIENT_ID: 'cid',
      GOOGLE_OAUTH_CLIENT_SECRET: 'csec',
      GOOGLE_OAUTH_SCOPES: ' https://www.googleapis.com/auth/androidpublisher , https://www.googleapis.com/auth/cloud-platform ',
    })

    expect(body).toMatchObject({ enabled: true })
    if (body.enabled) {
      expect(body.scopes).toEqual([
        'https://www.googleapis.com/auth/androidpublisher',
        'https://www.googleapis.com/auth/cloud-platform',
      ])
    }
  })

  it('falls back to the default scope when GOOGLE_OAUTH_SCOPES is set but yields zero non-empty entries', () => {
    const body = get({
      GOOGLE_OAUTH_CLIENT_ID: 'cid',
      GOOGLE_OAUTH_CLIENT_SECRET: 'csec',
      GOOGLE_OAUTH_SCOPES: ' , , ',
    })

    expect(body).toMatchObject({ enabled: true })
    if (body.enabled)
      expect(body.scopes).toEqual(['https://www.googleapis.com/auth/androidpublisher'])
  })
})
