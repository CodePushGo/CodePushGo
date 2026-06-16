export function encodeR2KeyForUploadLocation(r2Key: string): string {
  return r2Key.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

export function getAttachmentReadCandidateKeys(decodedKey: string, rawRouteKey: string | null | undefined): string[] {
  const candidates = [decodedKey]
  if (rawRouteKey && rawRouteKey !== decodedKey) {
    candidates.push(rawRouteKey)

    const encodedRawRouteKey = encodeR2KeyForUploadLocation(rawRouteKey)
    if (encodedRawRouteKey !== rawRouteKey && encodedRawRouteKey !== decodedKey)
      candidates.push(encodedRawRouteKey)
  }

  return [...new Set(candidates)]
}

export type AppScopedAttachmentPath = { kind: 'scoped', app_id: string, owner_org: string } | { kind: 'invalid_scoped' }

export function parseAppScopedAttachmentPath(fileId: unknown): AppScopedAttachmentPath | null {
  if (typeof fileId !== 'string')
    return null

  const [orgs, ownerOrg, apps, appId, ...suffix] = fileId.split('/')
  if (orgs !== 'orgs')
    return null

  if (!ownerOrg || apps !== 'apps' || !appId || suffix.length === 0 || suffix.some(part => part.length === 0))
    return { kind: 'invalid_scoped' }

  return { kind: 'scoped', app_id: appId, owner_org: ownerOrg }
}

function hasSameReadableAppScope(decodedKey: string, rawRouteKey: string) {
  const decodedScope = parseAppScopedAttachmentPath(decodedKey)
  const rawScope = parseAppScopedAttachmentPath(rawRouteKey)

  if (decodedScope?.kind !== 'scoped' || rawScope?.kind !== 'scoped')
    return false

  return decodedScope.owner_org === rawScope.owner_org && decodedScope.app_id === rawScope.app_id
}

export function getSafeAttachmentReadCandidateKeys(decodedKey: string, rawRouteKey: string | null): string[] {
  const candidateKeys = getAttachmentReadCandidateKeys(decodedKey, rawRouteKey)
  if (candidateKeys.length === 1 || !rawRouteKey || hasSameReadableAppScope(decodedKey, rawRouteKey))
    return candidateKeys

  return [decodedKey]
}

export interface AttachmentHeadReader<T> {
  head: (key: string) => Promise<T | null>
}

export async function headFirstExistingAttachmentCandidate<T>(reader: AttachmentHeadReader<T>, candidateKeys: string[]): Promise<T | null> {
  for (const candidateKey of candidateKeys) {
    const objectInfo = await reader.head(candidateKey)
    if (objectInfo != null)
      return objectInfo
  }

  return null
}
