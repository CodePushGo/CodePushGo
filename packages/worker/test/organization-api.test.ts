import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function orgBinding(roleName: string, orgId: string) {
  return [{ role_name: roleName, scope_type: 'org', org_id: orgId }]
}

async function createApiKey(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], roleName: string, orgId: string, globalPermissions: string[] = []) {
  const response = await app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: `${roleName}-${orgId}`, bindings: orgBinding(roleName, orgId), global_permissions: globalPermissions }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { key: string, id: number }
}

describe('[Capgo parity] organization API access control', () => {
  it('allows read-only org keys to read organizations and members but rejects destructive routes', async () => {
    const { app, env, storage } = testApp()
    const orgId = crypto.randomUUID()
    await storage.upsertOrganization({ id: orgId, name: 'Read Only Org', managementEmail: 'billing@example.com' })
    await storage.upsertOrgMembership({ orgId, userId: 'user-1', email: 'admin@example.com', role: 'super_admin' })
    const readOnlyKey = await createApiKey(app, env, 'org_member', orgId)
    const readOnlyHeaders = { authorization: `Bearer ${readOnlyKey.key}`, 'content-type': 'application/json' }

    const getOrg = await app.request(`https://api.test/organization?orgId=${orgId}`, { headers: readOnlyHeaders }, env)
    expect(getOrg.status).toBe(200)
    expect(await getOrg.json()).toMatchObject({ id: orgId, name: 'Read Only Org' })

    const members = await app.request(`https://api.test/organization/members?orgId=${orgId}`, { headers: readOnlyHeaders }, env)
    expect(members.status).toBe(200)
    expect(await members.json()).toContainEqual(expect.objectContaining({ uid: 'user-1', email: 'admin@example.com', role: 'super_admin' }))

    const addMember = await app.request('https://api.test/organization/members', {
      method: 'POST',
      headers: readOnlyHeaders,
      body: JSON.stringify({ orgId, email: 'blocked@example.com', invite_type: 'read' }),
    }, env)
    expect(addMember.status).toBe(400)
    expect(await addMember.json()).toMatchObject({ error: 'cannot_access_organization' })

    const update = await app.request('https://api.test/organization', {
      method: 'PUT',
      headers: readOnlyHeaders,
      body: JSON.stringify({ orgId, name: 'Blocked update' }),
    }, env)
    expect(update.status).toBe(400)
    expect(await update.json()).toMatchObject({ error: 'cannot_access_organization' })

    const remove = await app.request(`https://api.test/organization?orgId=${orgId}`, { method: 'DELETE', headers: readOnlyHeaders }, env)
    expect(remove.status).toBe(403)
    expect(await remove.json()).toMatchObject({ error: 'invalid_org_id' })
  })

  it('prevents scoped write keys from crossing organization boundaries', async () => {
    const { app, env, storage } = testApp()
    const allowedOrgId = crypto.randomUUID()
    const targetOrgId = crypto.randomUUID()
    await storage.upsertOrganization({ id: allowedOrgId, name: 'Allowed Org' })
    await storage.upsertOrganization({ id: targetOrgId, name: 'Target Org' })
    await storage.upsertOrgMembership({ orgId: targetOrgId, userId: 'target-user', email: 'target@example.com', role: 'read' })
    const scopedKey = await createApiKey(app, env, 'org_admin', allowedOrgId)
    const scopedHeaders = { authorization: `Bearer ${scopedKey.key}`, 'content-type': 'application/json' }

    const removeOrg = await app.request(`https://api.test/organization?orgId=${targetOrgId}`, { method: 'DELETE', headers: scopedHeaders }, env)
    expect(removeOrg.status).toBe(403)
    expect(await removeOrg.json()).toMatchObject({ error: 'invalid_org_id' })
    await expect(storage.getOrganization(targetOrgId)).resolves.toMatchObject({ id: targetOrgId })

    const removeMember = await app.request(`https://api.test/organization/members?orgId=${targetOrgId}&email=target@example.com`, { method: 'DELETE', headers: scopedHeaders }, env)
    expect(removeMember.status).toBe(400)
    expect(await removeMember.json()).toMatchObject({ error: 'cannot_access_organization' })
    await expect(storage.listOrgMemberships(targetOrgId)).resolves.toContainEqual(expect.objectContaining({ email: 'target@example.com' }))
  })

  it('allows org.create keys to create an organization and auto-bind to it', async () => {
    const { app, env } = testApp()
    const seedOrgId = crypto.randomUUID()
    const createdOrgName = `API Created ${crypto.randomUUID()}`
    const key = await createApiKey(app, env, 'org_admin', seedOrgId, ['org.create'])
    const keyHeaders = { authorization: `Bearer ${key.key}`, 'content-type': 'application/json' }

    const create = await app.request('https://api.test/organization', {
      method: 'POST',
      headers: keyHeaders,
      body: JSON.stringify({ name: createdOrgName, management_email: 'owner@example.com' }),
    }, env)
    expect(create.status).toBe(200)
    const created = await create.json() as { id: string, name: string }
    expect(created.name).toBe(createdOrgName)

    const getCreated = await app.request(`https://api.test/organization?orgId=${created.id}`, { headers: keyHeaders }, env)
    expect(getCreated.status).toBe(200)
    expect(await getCreated.json()).toMatchObject({ id: created.id, name: createdOrgName })
  })

  it('rejects organization creation without org.create permission', async () => {
    const { app, env } = testApp()
    const key = await createApiKey(app, env, 'org_member', crypto.randomUUID())
    const response = await app.request('https://api.test/organization', {
      method: 'POST',
      headers: { authorization: `Bearer ${key.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Blocked create' }),
    }, env)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'permission_denied' })
  })
})
