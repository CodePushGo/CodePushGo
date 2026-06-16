interface OrgResolverClient {
  listApps?: () => Promise<unknown>
}

const cache = new Map<string, string | undefined>()

function readOwnerOrg(app: unknown, appId: string) {
  if (!app || typeof app !== 'object')
    return undefined
  const record = app as Record<string, unknown>
  const candidateAppId = record.appId ?? record.app_id ?? record.bundle_id
  if (candidateAppId !== appId)
    return undefined
  const ownerOrg = record.ownerOrg ?? record.owner_org
  return typeof ownerOrg === 'string' ? ownerOrg : undefined
}

export async function resolveOwnerOrgId(input: { appId?: string, api?: OrgResolverClient }) {
  if (!input.appId || !input.api?.listApps)
    return undefined
  const key = input.appId
  if (cache.has(key))
    return cache.get(key)

  try {
    const result = await input.api.listApps()
    const apps = Array.isArray(result)
      ? result
      : result && typeof result === 'object' && Array.isArray((result as { apps?: unknown }).apps)
        ? (result as { apps: unknown[] }).apps
        : []
    const ownerOrg = apps.map(app => readOwnerOrg(app, input.appId!)).find(Boolean)
    cache.set(key, ownerOrg)
    return ownerOrg
  }
  catch {
    cache.set(key, undefined)
    return undefined
  }
}

export function clearOwnerOrgCache() {
  cache.clear()
}
