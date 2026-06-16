export interface StorageListItem {
  id: string | null
  name: string
}

function normalizeLogoPath(orgId: string, logoUrl: string | null | undefined) {
  if (!logoUrl)
    return null
  try {
    const parsed = new URL(logoUrl)
    const marker = `/storage/v1/object/sign/images/org/${orgId}/logo/`
    const markerIndex = parsed.pathname.indexOf(marker)
    if (markerIndex >= 0) {
      const fileName = parsed.pathname.slice(markerIndex + marker.length)
      return `org/${orgId}/logo/${decodeURIComponent(fileName)}`
    }
  }
  catch {
    // Raw storage paths are handled below.
  }

  const withoutImagesPrefix = logoUrl.startsWith('/images/') ? logoUrl.slice('/images/'.length) : logoUrl.replace(/^\/+/, '')
  const prefix = `org/${orgId}/logo/`
  if (!withoutImagesPrefix.startsWith(prefix))
    return null
  return decodeURIComponent(withoutImagesPrefix.split('?')[0] ?? withoutImagesPrefix)
}

export function getStaleOrgLogoPaths(orgId: string, files: StorageListItem[], linkedLogoUrl: string | null | undefined) {
  const linkedPath = normalizeLogoPath(orgId, linkedLogoUrl)
  return files
    .filter(file => file.id !== null)
    .map(file => `org/${orgId}/logo/${file.name}`)
    .filter(path => path !== linkedPath)
}
