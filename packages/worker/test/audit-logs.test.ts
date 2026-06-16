import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function orgBindings(orgId = 'default-org') {
  return [{ role_name: 'org_admin', scope_type: 'org', org_id: orgId }]
}

function keyHeaders(key: string) {
  return { capgkey: key, 'content-type': 'application/json' }
}

async function createApiKey(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], orgId = 'default-org') {
  const response = await app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: `audit-key-${crypto.randomUUID()}`, bindings: orgBindings(orgId) }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { id: number, key: string, rbac_id: string }
}

async function createAppRecord(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string, ownerOrg = 'default-org') {
  const response = await app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: ownerOrg }),
  }, env)
  expect(response.status).toBe(200)
}

describe('[Capgo parity] [GET] /organization/audit', () => {
  it('returns audit logs with pagination and filters', async () => {
    const { app, env } = testApp()
    const orgId = 'default-org'
    const appId = 'com.audit.logs.app'

    await createAppRecord(app, env, appId, orgId)
    const update = await app.request(`https://api.test/app/${appId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Updated Audit App' }),
    }, env)
    expect(update.status).toBe(200)

    const response = await app.request(`https://api.test/organization/audit?orgId=${orgId}`, { headers: authHeaders }, env)
    expect(response.status).toBe(200)
    const data = await response.json() as { data: Array<Record<string, unknown>>, total: number, page: number, limit: number }
    expect(data.page).toBe(0)
    expect(data.limit).toBe(50)
    expect(data.total).toBeGreaterThanOrEqual(2)
    expect(data.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ table_name: 'apps', record_id: appId, operation: 'INSERT', org_id: orgId }),
      expect.objectContaining({ table_name: 'apps', record_id: appId, operation: 'UPDATE', org_id: orgId, changed_fields: expect.arrayContaining(['name']) }),
    ]))

    const paged = await app.request(`https://api.test/organization/audit?orgId=${orgId}&page=0&limit=1`, { headers: authHeaders }, env)
    expect(paged.status).toBe(200)
    expect(await paged.json()).toMatchObject({ page: 0, limit: 1 })

    const tableFiltered = await app.request(`https://api.test/organization/audit?orgId=${orgId}&tableName=apps`, { headers: authHeaders }, env)
    expect(tableFiltered.status).toBe(200)
    const tableData = await tableFiltered.json() as { data: Array<{ table_name: string }> }
    expect(tableData.data.length).toBeGreaterThan(0)
    expect(tableData.data.every((row) => row.table_name === 'apps')).toBe(true)

    const operationFiltered = await app.request(`https://api.test/organization/audit?orgId=${orgId}&operation=UPDATE`, { headers: authHeaders }, env)
    expect(operationFiltered.status).toBe(200)
    const operationData = await operationFiltered.json() as { data: Array<{ operation: string }> }
    expect(operationData.data.length).toBeGreaterThan(0)
    expect(operationData.data.every((row) => row.operation === 'UPDATE')).toBe(true)
  })

  it('caps limit and returns Capgo error names for invalid org queries', async () => {
    const { app, env } = testApp()
    await createAppRecord(app, env, 'com.audit.limit', 'default-org')
    const capped = await app.request('https://api.test/organization/audit?orgId=default-org&limit=200', { headers: authHeaders }, env)
    expect(capped.status).toBe(200)
    expect(await capped.json()).toMatchObject({ limit: 100 })

    const missing = await app.request('https://api.test/organization/audit', { headers: authHeaders }, env)
    expect(missing.status).toBe(400)
    expect(await missing.json()).toMatchObject({ error: 'invalid_body' })

    const invalid = await app.request('https://api.test/organization/audit?orgId=unknown-org', { headers: authHeaders }, env)
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({ error: 'invalid_org_id' })
  })
})

describe('[Capgo parity] audit logs for API key authenticated bundle flow', () => {
  it('records app_versions INSERT, UPDATE, and soft-delete logs with API key user id', async () => {
    const { app, env } = testApp()
    const orgId = 'default-org'
    const appId = 'com.audit.bundle.flow'
    await createAppRecord(app, env, appId, orgId)
    const apiKey = await createApiKey(app, env, orgId)

    const createBundle = await app.request('https://api.test/bundle', {
      method: 'POST',
      headers: keyHeaders(apiKey.key),
      body: JSON.stringify({
        app_id: appId,
        version: '1.0.0',
        external_url: 'https://example.com/test-audit-bundle.zip',
        checksum: 'abc123def456',
      }),
    }, env)
    expect(createBundle.status).toBe(200)

    const metadata = await app.request('https://api.test/bundle/metadata', {
      method: 'POST',
      headers: keyHeaders(apiKey.key),
      body: JSON.stringify({ app_id: appId, version: '1.0.0', comment: 'Updated via API key test' }),
    }, env)
    expect(metadata.status).toBe(200)

    const remove = await app.request('https://api.test/bundle', {
      method: 'DELETE',
      headers: keyHeaders(apiKey.key),
      body: JSON.stringify({ app_id: appId, version: '1.0.0' }),
    }, env)
    expect(remove.status).toBe(200)

    const audit = await app.request(`https://api.test/organization/audit?orgId=${orgId}&tableName=app_versions`, { headers: authHeaders }, env)
    expect(audit.status).toBe(200)
    const data = await audit.json() as { data: Array<{ operation: string, user_id: string | null, changed_fields: string[] | null, new_record: Record<string, unknown> | null }> }
    expect(data.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: 'INSERT', user_id: apiKey.rbac_id }),
      expect.objectContaining({ operation: 'UPDATE', user_id: apiKey.rbac_id, changed_fields: expect.arrayContaining(['comment']) }),
      expect.objectContaining({ operation: 'UPDATE', user_id: apiKey.rbac_id, changed_fields: expect.arrayContaining(['deleted']) }),
    ]))
    expect(data.data.some((row) => row.new_record?.deleted === true)).toBe(true)
  })
})
