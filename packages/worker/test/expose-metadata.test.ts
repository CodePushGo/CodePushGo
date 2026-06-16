import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] expose_metadata app response contract', () => {
  it('lists expose_metadata for apps', async () => {
    const { app, env } = testApp()
    const appId = 'com.expose.metadata.list'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)
    await app.request(`https://api.test/app/${appId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ exposeMetadata: true }),
    }, env)

    const list = await app.request('https://api.test/app', { headers: authHeaders }, env)

    expect(list.status).toBe(200)
    expect(await list.json()).toEqual(expect.arrayContaining([expect.objectContaining({ app_id: appId, expose_metadata: true })]))
  })
})
