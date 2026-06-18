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

export interface CompatibilityEventGroup {
  key: string
  representative: CompatibilityEventRow
  events: CompatibilityEventRow[]
  platforms: string[]
  unresolvedEvents: CompatibilityEventRow[]
  resolved: boolean
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

function compatibilityGroupKey(row: CompatibilityEventRow) {
  return [
    row.source,
    row.channel_id ?? row.channel_name ?? 'channel',
    row.current_version_id ?? row.current_version_name ?? 'current',
    row.previous_version_id ?? row.previous_version_name ?? 'previous',
    row.change_occurred_at,
  ].join(':')
}

export function groupCompatibilityEvents(rows: CompatibilityEventRow[]): CompatibilityEventGroup[] {
  const groups = new Map<string, CompatibilityEventRow[]>()
  for (const row of rows) {
    const key = compatibilityGroupKey(row)
    const groupRows = groups.get(key) ?? []
    groupRows.push(row)
    groups.set(key, groupRows)
  }

  return [...groups.entries()].map(([key, events]) => {
    const representative = events[0]
    const unresolvedEvents = events.filter(event => !isResolved(event))
    return {
      key,
      representative,
      events,
      platforms: [...new Set(events.map(event => event.platform))].sort(),
      unresolvedEvents,
      resolved: unresolvedEvents.length === 0,
    }
  })
}

export async function listCompatibilityEvents(client: { from: (table: string) => any }, appId: string): Promise<CompatibilityEventRow[]> {
  const { data, error } = await client
    .from('compatibility_events')
    .select('id,org_id,app_id,source,platform,channel_id,channel_name,current_version_id,current_version_name,previous_version_id,previous_version_name,offenders,change_occurred_at,created_at,resolved_at,resolved_by,resolution_kind,resolution_note')
    .eq('app_id', appId)
    .order('created_at', { ascending: false })

  if (error)
    throw error
  return (data ?? []) as CompatibilityEventRow[]
}

export async function countUnresolvedCompatibilityGroups(client: { from: (table: string) => any }, appId: string) {
  const rows = await listCompatibilityEvents(client, appId)
  return groupCompatibilityEvents(rows).filter(group => !group.resolved).length
}

export function dependencyDiffPath(appId: string, row: Pick<CompatibilityEventRow, 'current_version_id' | 'previous_version_id'>) {
  if (row.current_version_id == null || row.previous_version_id == null)
    return null
  return `/app/${appId}/bundle/${row.current_version_id}/dependencies?compare=${row.previous_version_id}`
}
