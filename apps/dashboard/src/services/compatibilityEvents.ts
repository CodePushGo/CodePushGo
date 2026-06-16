export interface CompatibilityEventRow {
  id: number
  org_id: string
  app_id: string
  source: string
  platform: string
  channel_id: number | null
  channel_name: string | null
  current_version_id: number | null
  current_version_name: string | null
  previous_version_id: number | null
  previous_version_name: string | null
  offenders: string[]
  change_occurred_at: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_kind: string | null
  resolution_note: string | null
}

export function platformLabel(platform: string) {
  switch (platform) {
    case 'ios':
      return 'iOS'
    case 'android':
      return 'Android'
    case 'electron':
      return 'Electron'
    default:
      return platform
  }
}

export function isResolved(row: Pick<CompatibilityEventRow, 'resolved_at'>) {
  return row.resolved_at != null
}

function cleanNote(note: string | null | undefined) {
  const trimmed = note?.trim()
  return trimmed || undefined
}

export function reasonLabel(row: Pick<CompatibilityEventRow, 'resolved_at' | 'resolved_by' | 'resolution_kind' | 'resolution_note'>, resolvedByLabel?: string) {
  if (!isResolved(row))
    return null

  const note = cleanNote(row.resolution_note)
  if (row.resolution_kind === 'auto_compatible')
    return note ?? 'Resolved automatically - the default became compatible again.'

  if (row.resolution_kind === 'accepted') {
    const actor = resolvedByLabel ?? 'a team member'
    return note ? `Accepted by ${actor} - ${note}` : `Accepted by ${actor}`
  }

  return note ?? 'Resolved'
}

export function dependencyDiffPath(appId: string, row: Pick<CompatibilityEventRow, 'current_version_id' | 'previous_version_id'>) {
  if (row.current_version_id == null || row.previous_version_id == null)
    return null
  return `/app/${appId}/bundle/${row.current_version_id}/dependencies?compare=${row.previous_version_id}`
}
