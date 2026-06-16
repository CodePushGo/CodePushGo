import { describe, expect, it } from 'vitest'
import { normalizeWebsiteUrl } from '../src/organization-website'
import { authHeaders, testApp } from './helpers'

describe('normalizeWebsiteUrl', () => {
  it.concurrent('keeps explicit http and https urls', () => {
    expect(normalizeWebsiteUrl('https://example.com')).toBe('https://example.com/')
    expect(normalizeWebsiteUrl('http://example.com')).toBe('http://example.com/')
  })

  it.concurrent('adds https to host and host:port inputs', () => {
    expect(normalizeWebsiteUrl('example.com')).toBe('https://example.com/')
    expect(normalizeWebsiteUrl('example.com:3000')).toBe('https://example.com:3000/')
  })

  it.concurrent('rejects non-web schemes', () => {
    expect(() => normalizeWebsiteUrl('ftp://example.com')).toThrowError()
  })

  it.concurrent('rejects credential-bearing urls', () => {
    expect(() => normalizeWebsiteUrl('https://user:pass@example.com')).toThrowError()
    expect(() => normalizeWebsiteUrl('user:pass@example.com')).toThrowError()
  })
})

describe('[Capgo parity] organization website API', () => {
  it('normalizes website on create and update', async () => {
    const { app, env } = testApp()
    const orgId = crypto.randomUUID()

    const create = await app.request('https://api.test/organization', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: orgId, name: 'Website Org', website: 'HTTPS://capgo.app' }),
    }, env)
    expect(create.status).toBe(200)
    expect(await create.json()).toMatchObject({ id: orgId, website: 'https://capgo.app/' })

    const update = await app.request('https://api.test/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ orgId, name: 'Website Org Renamed', website: 'www.capgo.app/docs' }),
    }, env)
    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({ id: orgId, website: 'https://www.capgo.app/docs' })
  })

  it('rejects invalid website values before writing', async () => {
    const { app, env, storage } = testApp()
    const orgId = crypto.randomUUID()
    await storage.upsertOrganization({ id: orgId, name: 'Existing Org', website: 'https://old.example/' })

    const create = await app.request('https://api.test/organization', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: crypto.randomUUID(), name: 'Bad Org', website: 'ftp://capgo.app' }),
    }, env)
    expect(create.status).toBe(400)
    expect(await create.json()).toMatchObject({ error: 'invalid_body' })

    const update = await app.request('https://api.test/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ orgId, website: 'https://user:pass@www.capgo.app/docs' }),
    }, env)
    expect(update.status).toBe(400)
    expect(await update.json()).toMatchObject({ error: 'invalid_body' })
    await expect(storage.getOrganization(orgId)).resolves.toMatchObject({ website: 'https://old.example/' })
  })
})
