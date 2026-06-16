import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const userHeaders = {
  authorization: 'Bearer test-token',
  'content-type': 'application/json',
}

const adminHeaders = {
  authorization: 'Bearer admin-token',
  'content-type': 'application/json',
}

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token', CODEPUSHGO_ADMIN_API_KEY: 'admin-token' } as Env
  return { app, env, storage }
}

describe('[Capgo parity] admin credits endpoints', () => {
  it('returns Capgo-compatible errors for missing auth and non-admin auth before body validation', async () => {
    const { app, env } = testApp()
    const orgId = randomUUID()
    const endpoints = [
      { method: 'POST', path: '/private/admin_credits/grant', body: JSON.stringify({ org_id: orgId, amount: 100 }) },
      { method: 'GET', path: '/private/admin_credits/search-orgs?q=test' },
      { method: 'GET', path: `/private/admin_credits/org-balance/${orgId}` },
      { method: 'GET', path: '/private/admin_credits/grants-history' },
    ]

    for (const endpoint of endpoints) {
      const missingAuth = await app.request(`https://api.test${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'content-type': 'application/json' },
        body: endpoint.body,
      }, env)
      expect(missingAuth.status).toBe(401)
      expect(await missingAuth.json()).toMatchObject({ error: 'no_jwt_apikey_or_subkey' })

      const notAdmin = await app.request(`https://api.test${endpoint.path}`, {
        method: endpoint.method,
        headers: userHeaders,
        body: endpoint.body ?? (endpoint.method === 'POST' ? 'invalid json' : undefined),
      }, env)
      expect(notAdmin.status).toBe(400)
      expect(await notAdmin.json()).toMatchObject({ error: 'not_admin' })
    }
  })

  it('rejects non-admin search inputs without evaluating SQL-like patterns', async () => {
    const { app, env } = testApp()
    const injectionPatterns = [
      'test%\'; DROP TABLE orgs; --',
      'test\' OR \'1\'=\'1',
      'test%,test2',
      '%()',
    ]

    for (const pattern of injectionPatterns) {
      const response = await app.request(`https://api.test/private/admin_credits/search-orgs?q=${encodeURIComponent(pattern)}`, { headers: userHeaders }, env)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'not_admin' })
    }
  })

  it('lets an admin search organizations, grant credits, read balance, and view grant history', async () => {
    const { app, env, storage } = testApp()
    const orgId = randomUUID()
    await storage.upsertOrganization({
      id: orgId,
      name: `Admin Credits Test Org ${orgId}`,
      managementEmail: 'owner@example.com',
      createdBy: 'owner-user',
      customerId: `cus_${orgId}`,
    })

    const search = await app.request(`https://api.test/private/admin_credits/search-orgs?q=${orgId}`, { headers: adminHeaders }, env)
    expect(search.status).toBe(200)
    const searchBody = await search.json() as { orgs: Array<{ id: string }> }
    expect(searchBody.orgs.some(org => org.id === orgId)).toBe(true)

    const grant = await app.request('https://api.test/private/admin_credits/grant', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ org_id: orgId, amount: 25, notes: 'Admin grant test' }),
    }, env)
    expect(grant.status).toBe(200)
    const grantBody = await grant.json() as { success: boolean, org: { id: string } }
    expect(grantBody.success).toBe(true)
    expect(grantBody.org.id).toBe(orgId)

    const balance = await app.request(`https://api.test/private/admin_credits/org-balance/${orgId}`, { headers: adminHeaders }, env)
    expect(balance.status).toBe(200)
    const balanceBody = await balance.json() as { balance: { total_credits: number, available_credits: number } }
    expect(balanceBody.balance.total_credits).toBeGreaterThanOrEqual(25)
    expect(balanceBody.balance.available_credits).toBeGreaterThanOrEqual(25)

    const history = await app.request('https://api.test/private/admin_credits/grants-history', { headers: adminHeaders }, env)
    expect(history.status).toBe(200)
    const historyBody = await history.json() as { grants: Array<{ org_id: string, amount: number }> }
    expect(historyBody.grants).toContainEqual(expect.objectContaining({ org_id: orgId, amount: 25 }))
  })
})
