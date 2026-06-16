import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function keyHeaders(key: string) {
  return { capgkey: key, 'content-type': 'application/json' }
}

async function createDestinationOrgKey(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], orgId: string) {
  const response = await app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `transfer-key-${crypto.randomUUID()}`,
      bindings: [{ role_name: 'org_admin', scope_type: 'org', org_id: orgId }],
    }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { key: string }
}

async function seedTransferApp() {
  const ctx = testApp()
  const appId = `com.transfer.security.${crypto.randomUUID()}`
  const create = await ctx.app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, ctx.env)
  expect(create.status).toBe(200)

  const bundle = await ctx.app.request('https://api.test/bundle', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      app_id: appId,
      version: '1.0.0',
      checksum: 'abc123',
      external_url: 'https://example.com/transfer-bundle.zip',
    }),
  }, ctx.env)
  expect(bundle.status).toBe(200)
  return { ...ctx, appId }
}

describe('[Capgo parity] app transfer security', () => {
  it('rejects raw owner_org updates on apps', async () => {
    const { app, env, storage, appId } = await seedTransferApp()

    const response = await app.request(`https://api.test/app/${appId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ owner_org: 'destination-org' }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'cannot_update_app' })
    expect(await storage.getApp(appId)).toMatchObject({ ownerOrg: 'default-org', transferHistory: [] })
    expect(await storage.listReleases(appId)).toEqual([
      expect.objectContaining({ ownerOrg: 'default-org' }),
    ])
  })

  it('moves app and release ownership through the approved transfer path', async () => {
    const { app, env, storage, appId } = await seedTransferApp()
    const destinationOrg = `transfer-destination-${crypto.randomUUID()}`
    const apiKey = await createDestinationOrgKey(app, env, destinationOrg)

    const response = await app.request(`https://api.test/app/${appId}/transfer`, {
      method: 'POST',
      headers: keyHeaders(apiKey.key),
      body: JSON.stringify({ owner_org: destinationOrg }),
    }, env)

    expect(response.status).toBe(200)
    const body = await response.json() as { owner_org: string, transfer_history: Array<{ fromOrg: string | null, toOrg: string }> }
    expect(body.owner_org).toBe(destinationOrg)
    expect(body.transfer_history).toEqual([
      expect.objectContaining({ fromOrg: 'default-org', toOrg: destinationOrg }),
    ])
    expect(await storage.getApp(appId)).toMatchObject({ ownerOrg: destinationOrg })
    expect(await storage.listReleases(appId)).toEqual([
      expect.objectContaining({ ownerOrg: destinationOrg }),
    ])
  })
})
