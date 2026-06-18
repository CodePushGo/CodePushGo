import { describe, expect, it, vi } from 'vitest'
import { buildOrganizationMembersPath, deleteOrganizationMember, listOrganizationMembers, normalizeOrganizationRole, roleLabel, upsertOrganizationMember } from './organizationMembers'
import { webhookHeaders } from './webhooks'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

const options = {
  apiUrl: 'https://api.example.com/',
  apiKey: 'cpg_test',
  orgId: 'org_123',
}

describe('[Capgo parity] Worker-backed organization members service', () => {
  it('builds the organization members Worker path and roles', () => {
    expect(buildOrganizationMembersPath(options)).toBe('https://api.example.com/organization/members?orgId=org_123')
    expect(buildOrganizationMembersPath(options, { email: 'dev@example.com' })).toBe('https://api.example.com/organization/members?orgId=org_123&email=dev%40example.com')
    expect(normalizeOrganizationRole('org_super_admin')).toBe('super_admin')
    expect(normalizeOrganizationRole('org_admin')).toBe('admin')
    expect(normalizeOrganizationRole('org_member')).toBe('read')
    expect(roleLabel('super_admin')).toBe('Super admin')
  })

  it('lists organization members with bearer auth', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ uid: 'user-1', email: 'dev@example.com', role: 'super_admin' }]))
    await expect(listOrganizationMembers({ ...options, fetcher })).resolves.toEqual([{ uid: 'user-1', email: 'dev@example.com', role: 'super_admin' }])
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/organization/members?orgId=org_123', {
      method: 'GET',
      headers: webhookHeaders('cpg_test'),
    })
  })

  it('adds and updates members through POST /organization/members', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ status: 'ok', uid: 'user-1', email: 'dev@example.com', role: 'admin' }))
    await expect(upsertOrganizationMember({ ...options, fetcher }, { email: 'DEV@example.com', role: 'org_admin', userId: 'user-1' })).resolves.toMatchObject({ success: true })
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][]
    expect(calls[0][0]).toBe('https://api.example.com/organization/members?orgId=org_123')
    expect(calls[0][1].method).toBe('POST')
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ orgId: 'org_123', email: 'dev@example.com', role: 'admin', userId: 'user-1' })
  })

  it('removes members through DELETE /organization/members', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ status: 'ok' }))
    await expect(deleteOrganizationMember({ ...options, fetcher }, 'DEV@example.com')).resolves.toEqual({ success: true })
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/organization/members?orgId=org_123&email=dev%40example.com', {
      method: 'DELETE',
      headers: webhookHeaders('cpg_test'),
    })
  })
})
