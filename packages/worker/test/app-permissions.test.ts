import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] app creation permission tests', () => {
  it('fails to create an app with a non-existent organization', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: `com.permission.test.${randomUUID()}`,
        owner_org: randomUUID(),
        name: 'Permission Test App',
        icon: 'test-icon',
      }),
    }, env)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'cannot_access_organization' })
  })

  it('fails to create an app with an organization the user cannot access', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: `com.permission.test.${randomUUID()}`,
        owner_org: `unauthorized-${randomUUID()}`,
        name: 'Permission Test App',
        icon: 'test-icon',
      }),
    }, env)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'cannot_access_organization' })
  })

  it('creates an app when the auth can access the organization', async () => {
    const { app, env } = testApp()
    const appId = `com.permission.test.${randomUUID()}`
    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: appId,
        owner_org: 'default-org',
        name: `App ${appId}`,
        icon: 'test-icon',
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ app_id: appId, owner_org: 'default-org' })
  })

  it('fails to create an app without an organization', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        app_id: `com.permission.test.${randomUUID()}`,
        name: 'Permission Test App',
        icon: 'test-icon',
      }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'missing_owner_org' })
  })
})
