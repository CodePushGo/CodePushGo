import { buildWebhookApiPath, webhookHeaders } from './webhooks'

export type OrganizationRole = 'read' | 'org_member' | 'admin' | 'org_admin' | 'super_admin' | 'org_super_admin'

export interface OrganizationMember {
  uid: string
  user_id?: string
  email: string
  role: string
  is_invite?: boolean
}

export interface OrganizationMemberOptions {
  apiUrl?: string
  apiKey: string
  orgId: string
  fetcher?: typeof fetch
}

function getFetcher(fetcher: typeof fetch | undefined) {
  return fetcher ?? fetch
}

async function parseWorkerResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : fallback
    throw new Error(message)
  }
  return data as T
}

export function normalizeOrganizationRole(role: string) {
  const normalized = role.trim()
  return normalized === 'org_super_admin' ? 'super_admin' : normalized === 'org_admin' ? 'admin' : normalized === 'org_member' ? 'read' : normalized
}

export function roleLabel(role: string) {
  const labels: Record<string, string> = {
    read: 'Member',
    org_member: 'Member',
    admin: 'Admin',
    org_admin: 'Admin',
    super_admin: 'Super admin',
    org_super_admin: 'Super admin',
  }
  return labels[role] || role.replaceAll('_', ' ')
}

export function buildOrganizationMembersPath(options: Pick<OrganizationMemberOptions, 'apiUrl' | 'orgId'>, params: Record<string, string | undefined> = {}) {
  return buildWebhookApiPath('/organization/members', { orgId: options.orgId, ...params }, options.apiUrl)
}

export async function listOrganizationMembers(options: OrganizationMemberOptions): Promise<OrganizationMember[]> {
  const response = await getFetcher(options.fetcher)(buildOrganizationMembersPath(options), {
    method: 'GET',
    headers: webhookHeaders(options.apiKey),
  })
  const data = await parseWorkerResponse<unknown>(response, 'Failed to fetch organization members')
  return Array.isArray(data) ? data as OrganizationMember[] : []
}

export async function upsertOrganizationMember(options: OrganizationMemberOptions, input: { email: string, role: string, userId?: string }): Promise<{ success: boolean, member?: OrganizationMember, error?: string }> {
  try {
    const response = await getFetcher(options.fetcher)(buildOrganizationMembersPath(options, {}), {
      method: 'POST',
      headers: webhookHeaders(options.apiKey),
      body: JSON.stringify({
        orgId: options.orgId,
        email: input.email.trim().toLowerCase(),
        role: normalizeOrganizationRole(input.role),
        userId: input.userId?.trim() || undefined,
      }),
    })
    const member = await parseWorkerResponse<OrganizationMember>(response, 'Failed to save organization member')
    return { success: true, member }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function deleteOrganizationMember(options: OrganizationMemberOptions, email: string): Promise<{ success: boolean, error?: string }> {
  try {
    const response = await getFetcher(options.fetcher)(buildOrganizationMembersPath(options, { email: email.trim().toLowerCase() }), {
      method: 'DELETE',
      headers: webhookHeaders(options.apiKey),
    })
    await parseWorkerResponse(response, 'Failed to remove organization member')
    return { success: true }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
