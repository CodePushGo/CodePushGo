import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] expose_metadata via CLI/API integration', () => {
  it('enables and disables expose_metadata through PUT /app/:appId', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.expose.metadata.cli'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: 'Expose Metadata', owner_org: 'default-org' }),
    }, env)

    const enable = await app.request(`https://api.test/app/${appId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ expose_metadata: true }),
    }, env)
    expect(enable.status).toBe(200)
    expect(await enable.json()).toMatchObject({ expose_metadata: true, exposeMetadata: true })
    expect(await storage.getApp(appId)).toMatchObject({ exposeMetadata: true })

    const disable = await app.request(`https://api.test/app/${appId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ expose_metadata: false }),
    }, env)
    expect(disable.status).toBe(200)
    expect(await disable.json()).toMatchObject({ expose_metadata: false, exposeMetadata: false })
    expect(await storage.getApp(appId)).toMatchObject({ exposeMetadata: false })
  })

  it('updates expose_metadata along with other app settings and preserves existing settings', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.expose.metadata.update'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: 'Original App', owner_org: 'default-org' }),
    }, env)

    const update = await app.request(`https://api.test/app/${appId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Updated App Name', expose_metadata: true }),
    }, env)

    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({ name: 'Updated App Name', expose_metadata: true })
    expect(await storage.getApp(appId)).toMatchObject({ name: 'Updated App Name', exposeMetadata: true, ownerOrg: 'default-org' })
  })

  it('returns expose_metadata in GET /app/:appId and defaults to false on creation', async () => {
    const { app, env, storage } = testApp()
    const appId = 'com.expose.metadata.default'
    const create = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: 'Default App', owner_org: 'default-org' }),
    }, env)
    expect(create.status).toBe(200)
    expect(await storage.getApp(appId)).toMatchObject({ exposeMetadata: false })

    const get = await app.request(`https://api.test/app/${appId}`, { headers: authHeaders }, env)

    expect(get.status).toBe(200)
    expect(await get.json()).toMatchObject({ app_id: appId, expose_metadata: false, exposeMetadata: false })
  })

  it('requires proper authorization to update expose_metadata', async () => {
    const { app, env } = testApp()
    const appId = 'com.expose.metadata.auth'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: 'Auth App', owner_org: 'default-org' }),
    }, env)

    const response = await app.request(`https://api.test/app/${appId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid-api-key' },
      body: JSON.stringify({ expose_metadata: true }),
    }, env)

    expect([401, 403]).toContain(response.status)
  })
})
