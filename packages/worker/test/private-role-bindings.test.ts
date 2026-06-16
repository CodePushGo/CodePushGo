import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage, type Env } from '../src/index'

const env: Env = { CODEPUSHGO_API_KEY: 'test-token' }
const headers = {
  authorization: 'Bearer test-token',
  'content-type': 'application/json',
}

function fixture() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  return { app, storage }
}

describe('[Capgo parity] /private/role_bindings', () => {
  it('accepts channel-scoped bindings and preserves the channel RBAC id', async () => {
    const { app, storage } = fixture()
    const orgId = randomUUID()
    const appId = randomUUID()
    const channelRbacId = randomUUID()
    await storage.upsertOrganization({ id: orgId, name: 'Role Binding Org' })
    await storage.createApp(appId, 'Role Binding App', orgId)

    const response = await app.request('http://localhost/private/role_bindings', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        principal_type: 'user',
        principal_id: randomUUID(),
        role_name: 'channel_reader',
        scope_type: 'channel',
        org_id: orgId,
        app_id: appId,
        channel_id: channelRbacId,
        reason: 'channel uuid regression',
      }),
    }, env)

    const data = await response.json() as { id: string, app_id: string, channel_id: string, role_name: string, scope_type: string }
    expect(response.status).toBe(200)
    expect(data.scope_type).toBe('channel')
    expect(data.role_name).toBe('channel_reader')
    expect(data.app_id).toBe(appId)
    expect(data.channel_id).toBe(channelRbacId)
    await expect(storage.getRoleBinding(data.id)).resolves.toMatchObject({ channelId: channelRbacId })
  })

  it('allows app readers to fetch direct channel bindings for an app', async () => {
    const { app, storage } = fixture()
    const orgId = randomUUID()
    const appId = randomUUID()
    const channelRbacId = randomUUID()
    await storage.createApp(appId, 'Role Binding App', orgId)
    await storage.createRoleBinding({
      principalType: 'user',
      principalId: randomUUID(),
      roleName: 'channel_reader',
      scopeType: 'channel',
      orgId,
      appId,
      channelId: channelRbacId,
      reason: 'fetch direct channel bindings',
    })

    const response = await app.request(`http://localhost/private/role_bindings/app/${appId}/channel`, { headers }, env)
    const data = await response.json() as Array<{ app_id: string, channel_id: string, role_name: string, scope_type: string }>

    expect(response.status).toBe(200)
    expect(data).toContainEqual(expect.objectContaining({
      app_id: appId,
      channel_id: channelRbacId,
      role_name: 'channel_reader',
      scope_type: 'channel',
    }))
  })

  it('rejects app-scoped bindings when the target app belongs to another org', async () => {
    const { app, storage } = fixture()
    const attackerOrgId = randomUUID()
    const victimOrgId = randomUUID()
    const victimAppId = randomUUID()
    const principalId = randomUUID()
    await storage.createApp(victimAppId, 'Victim App', victimOrgId)

    const response = await app.request('http://localhost/private/role_bindings', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        principal_type: 'user',
        principal_id: principalId,
        role_name: 'app_admin',
        scope_type: 'app',
        org_id: attackerOrgId,
        app_id: victimAppId,
        reason: 'cross-org regression',
      }),
    }, env)

    const data = await response.json() as { error: string }
    expect(response.status).toBe(404)
    expect(data.error).toBe('App not found in this org')
    expect(await storage.listRoleBindingsForAppScope(victimAppId)).toHaveLength(0)
  })

  it('clears legacy org user rights when an org-scope user binding is deleted', async () => {
    const { app, storage } = fixture()
    const orgId = randomUUID()
    const userId = randomUUID()
    await storage.upsertOrgMembership({ orgId, userId, email: 'member@example.com', role: 'super_admin' })
    const binding = await storage.createRoleBinding({
      principalType: 'user',
      principalId: userId,
      roleName: 'org_super_admin',
      scopeType: 'org',
      orgId,
      reason: 'delete advisory regression',
    })
    expect(binding).toBeTruthy()

    const response = await app.request(`http://localhost/private/role_bindings/${binding!.id}`, {
      method: 'DELETE',
      headers,
    }, env)
    const data = await response.json() as { success?: boolean }

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    await expect(storage.getOrgMembership(userId, orgId)).resolves.toMatchObject({ role: '' })
  })

  it('removes user channel permission overrides when app access is removed', async () => {
    const { app, storage } = fixture()
    const orgId = randomUUID()
    const appId = randomUUID()
    const userId = randomUUID()
    const channelId = randomUUID()
    await storage.createApp(appId, 'Override Cleanup App', orgId)
    const binding = await storage.createRoleBinding({
      principalType: 'user',
      principalId: userId,
      roleName: 'app_reader',
      scopeType: 'app',
      orgId,
      appId,
      reason: 'override cleanup target',
    })
    await storage.upsertChannelPermissionOverride({
      principalType: 'user',
      principalId: userId,
      channelId,
      permissionKey: 'channel.promote_bundle',
      isAllowed: true,
    })

    const response = await app.request(`http://localhost/private/role_bindings/${binding!.id}`, {
      method: 'DELETE',
      headers,
    }, env)

    expect(response.status).toBe(200)
    await expect(storage.listChannelPermissionOverrides('user', userId)).resolves.toHaveLength(0)
  })

  it('returns a conflict when the last org_super_admin binding cannot be demoted', async () => {
    const { app, storage } = fixture()
    const orgId = randomUUID()
    const binding = await storage.createRoleBinding({
      principalType: 'user',
      principalId: randomUUID(),
      roleName: 'org_super_admin',
      scopeType: 'org',
      orgId,
      reason: 'last super admin regression',
    })

    const response = await app.request(`http://localhost/private/role_bindings/${binding!.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role_name: 'org_member' }),
    }, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(409)
    expect(data.error).toBe('Cannot demote the last org_super_admin')
    await expect(storage.getRoleBinding(binding!.id)).resolves.toMatchObject({ roleName: 'org_super_admin' })
  })
})
