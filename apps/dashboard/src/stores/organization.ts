import { reactive } from 'vue'
import { createSignedImageUrl, getImmediateImageUrl, resolveImagePath } from '../services/storage'
import { useSupabase } from '../services/supabase'
import { syncWebsitePaidUserCookieFromOrganizations } from '../services/websiteAuthCookie'
import { useMainStore } from './main'

export interface Organization {
  gid: string
  id?: string
  name?: string | null
  role?: string | null
  use_new_rbac?: boolean | null
  logo?: string | null
  logo_storage_path?: string | null
  created_by?: string | null
  [key: string]: unknown
}

type LegacyRight = 'read' | 'admin' | 'super_admin'

const legacyRank: Record<LegacyRight, number> = {
  read: 0,
  admin: 1,
  super_admin: 2,
}

const roleRanks: Record<string, number> = {
  read: 0,
  member: 0,
  org_member: 0,
  invite_org_user: 0,
  invite_org_member: 0,
  admin: 1,
  org_admin: 1,
  invite_org_admin: 1,
  super_admin: 2,
  owner: 2,
  org_super_admin: 2,
  invite_org_super_admin: 2,
}

const state = reactive({
  organizations: [] as Organization[],
  currentOrganization: null as Organization | null,
})

const allOrgs = new Map<string, Organization>()
let organizationsLoad: Promise<{ data: Organization[] | null, error: unknown } | undefined> | undefined

function organizationId(org: Organization) {
  return org.gid || org.id || ''
}

function upsertOrganization(org: Organization) {
  const id = organizationId(org)
  if (!id)
    return

  const existing = allOrgs.get(id)
  if (existing)
    Object.assign(existing, org)
  else
    allOrgs.set(id, org)
}

function syncOrganizationsFromMap() {
  state.organizations = Array.from(allOrgs.values())
}

function roleRank(role: string | null | undefined) {
  if (!role)
    return -1
  return roleRanks[role] ?? -1
}

export function roleHasLegacyMinRight(role: string | null | undefined, minRight: LegacyRight) {
  return roleRank(role) >= legacyRank[minRight]
}

export function isAdminRole(role: string | null | undefined) {
  return roleHasLegacyMinRight(role, 'admin')
}

export function isSuperAdminRole(role: string | null | undefined) {
  return roleHasLegacyMinRight(role, 'super_admin')
}

async function refreshLogoForOrg(org: Organization) {
  const rawPath = org.logo_storage_path || org.logo
  const resolved = resolveImagePath(rawPath)
  if (!resolved.normalized)
    return

  const signedUrl = resolved.shouldSign ? await createSignedImageUrl(resolved.normalized) : getImmediateImageUrl(resolved.normalized)
  if (signedUrl)
    org.logo = signedUrl
  if (resolved.shouldSign)
    org.logo_storage_path = resolved.normalized
}
export function useOrganizationStore() {
  async function fetchOrganizations() {
    const mainStore = useMainStore() as unknown as { user?: unknown, auth?: unknown }
    if (!mainStore.user && !mainStore.auth) {
      // CodePushGo's Worker auth still comes from request cookies or API keys, so fetch anyway.
    }

    const { data, error } = await useSupabase().rpc<Organization[]>('get_orgs_v7')
    if (error)
      return { data: null, error }

    allOrgs.clear()
    for (const org of data ?? []) {
      if (!org.logo && org.logo_storage_path)
        org.logo = getImmediateImageUrl(org.logo_storage_path)
      upsertOrganization(org)
    }
    syncOrganizationsFromMap()
    syncWebsitePaidUserCookieFromOrganizations(state.organizations)
    state.currentOrganization = state.currentOrganization
      ? allOrgs.get(organizationId(state.currentOrganization)) ?? state.organizations[0] ?? null
      : state.organizations[0] ?? null

    return { data: state.organizations, error: null }
  }

  async function dedupFetchOrganizations() {
    organizationsLoad ??= fetchOrganizations().finally(() => {
      organizationsLoad = undefined
    })
    return await organizationsLoad
  }

  async function awaitInitialLoad() {
    return await (organizationsLoad ?? dedupFetchOrganizations())
  }

  async function deleteOrganization(orgId: string) {
    const org = allOrgs.get(orgId)
    if (!isSuperAdminRole(org?.role))
      return { data: null, error: new Error('Insufficient permissions') }

    const result = await useSupabase().from('orgs').delete().eq('id', orgId)
    if (!result.error) {
      allOrgs.delete(orgId)
      syncOrganizationsFromMap()
      if (state.currentOrganization && organizationId(state.currentOrganization) === orgId)
        state.currentOrganization = state.organizations[0] ?? null
    }
    return result
  }

  async function refreshOrganizationLogos() {
    await Promise.all(Array.from(allOrgs.values()).map(refreshLogoForOrg))
    if (state.currentOrganization) {
      const current = allOrgs.get(organizationId(state.currentOrganization))
      if (current && current !== state.currentOrganization)
        Object.assign(state.currentOrganization, current)
      else
        await refreshLogoForOrg(state.currentOrganization)
    }
    syncOrganizationsFromMap()
  }

  return {
    get organizations() { return state.organizations },
    set organizations(value: Organization[]) {
      allOrgs.clear()
      for (const org of value)
        upsertOrganization(org)
      syncOrganizationsFromMap()
    },
    get hasOrganizations() { return state.organizations.length > 0 },
    get currentOrganization() { return state.currentOrganization },
    set currentOrganization(value: Organization | null) { state.currentOrganization = value },
    getAllOrgs: () => allOrgs,
    fetchOrganizations,
    dedupFetchOrganizations,
    awaitInitialLoad,
    deleteOrganization,
    refreshOrganizationLogos,
  }
}
