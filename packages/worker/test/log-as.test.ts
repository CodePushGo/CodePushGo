import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const userId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'
const statsId = '33333333-3333-4333-8333-333333333333'
const staleCreatedByUserId = '44444444-4444-4444-8444-444444444444'
const currentAdminId = '55555555-5555-4555-8555-555555555555'
const orgId = '66666666-6666-4666-8666-666666666666'
const staleOrgId = '77777777-7777-4777-8777-777777777777'

function jwtSub(jwt: string) {
  const [, payload] = jwt.split('.')
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).sub as string
}

async function seedLogAsData(storage: ReturnType<typeof testApp>['storage']) {
  await storage.upsertOrganization({ id: orgId, name: 'Org 2', createdBy: ownerId })
  await storage.upsertOrgMembership({ orgId, userId: ownerId, email: 'owner@codepushgo.test', role: 'super_admin' })
  await storage.upsertOrgMembership({ orgId, userId: userId, email: 'user@codepushgo.test', role: 'read' })
  await storage.upsertOrgMembership({ orgId, userId: statsId, email: 'stats@capgo.app', role: 'read' })

  await storage.upsertOrganization({ id: staleOrgId, name: 'Stale owner org', createdBy: staleCreatedByUserId })
  await storage.upsertOrgMembership({ orgId: staleOrgId, userId: currentAdminId, email: 'current-admin@codepushgo.test', role: 'super_admin' })
}

async function callLogAs(body: Record<string, string>) {
  const { app, env, storage } = testApp()
  await seedLogAsData(storage)

  const response = await app.request('/private/log_as', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(body),
  }, { ...env, JWT_SECRET: 'test-jwt-secret' })

  const data = await response.json() as { jwt?: string, refreshToken?: string, error?: string }
  expect(response.status).toBe(200)
  expect(data.error).toBeUndefined()
  expect(data.jwt).toBeTruthy()
  expect(data.refreshToken).toBeTruthy()
  return data.jwt!
}

describe('[Capgo parity] [POST] /private/log_as', () => {
  it('keeps user_id impersonation compatibility', async () => {
    expect(jwtSub(await callLogAs({ user_id: userId }))).toBe(userId)
  })

  it('impersonates a user by auth email', async () => {
    expect(jwtSub(await callLogAs({ identifier: 'stats@capgo.app' }))).toBe(statsId)
  })

  it('impersonates an organization owner by org id', async () => {
    expect(jwtSub(await callLogAs({ org_id: orgId }))).toBe(ownerId)
  })

  it('impersonates a current organization owner when created_by is stale', async () => {
    expect(jwtSub(await callLogAs({ org_id: staleOrgId }))).toBe(currentAdminId)
  })

  it('treats an unresolved UUID identifier as an organization id', async () => {
    expect(jwtSub(await callLogAs({ identifier: orgId }))).toBe(ownerId)
  })
})
