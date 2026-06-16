export type CompatibilityPlatform = 'ios' | 'android' | 'electron'

export interface NativePackage {
  name: string
  version: string
}

export interface CompatibilityBundle {
  id: number
  name: string
  nativePackages: NativePackage[] | null
}

export type CompatibilityEventSource = 'default_channel_changed' | 'default_channel_version_changed'

export interface PreviousDefault {
  platform: CompatibilityPlatform
  source: CompatibilityEventSource
  bundle: CompatibilityBundle
}

export interface CompatibilityChannel {
  id: number
  app_id: string
  owner_org: string
  name: string
  version: number
  public: boolean
  ios: boolean
  android: boolean
  electron: boolean
  disable_auto_update: string
}

export interface DecideCompatibilityEventsInput {
  changeOccurredAt: string
  newChannel: CompatibilityChannel
  currentBundle: CompatibilityBundle
  previousDefaults: PreviousDefault[]
}

export interface CompatibilityEventRecord {
  org_id: string
  app_id: string
  source: CompatibilityEventSource
  platform: CompatibilityPlatform
  channel_id: number
  channel_name: string
  current_version_id: number
  current_version_name: string
  previous_version_id: number
  previous_version_name: string
  offenders: string[]
  change_occurred_at: string
}

export interface UnresolvedCompatibilityEvent {
  id: number
  platform: CompatibilityPlatform
  previous_version_id: number
  previous_version_name: string
  current_version_id: number
}

export interface CurrentDefaultForPlatform {
  platform: CompatibilityPlatform
  bundle: CompatibilityBundle
}

export interface AutoResolveDecision {
  id: number
  note: string
}

export interface StoredCompatibilityEvent {
  id: number
  org_id: string
  app_id: string
  source: CompatibilityEventSource
  platform: CompatibilityPlatform
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

export interface ProcessCompatibilityUpdateInput extends DecideCompatibilityEventsInput {
  unresolvedEvents: UnresolvedCompatibilityEvent[]
  currentDefaults: CurrentDefaultForPlatform[]
  bundlesById: Map<number, CompatibilityBundle>
  existingEvents: StoredCompatibilityEvent[]
  now?: () => string
}

const PLATFORMS: CompatibilityPlatform[] = ['ios', 'android', 'electron']

function packageMap(packages: NativePackage[] | null) {
  if (!packages?.length)
    return undefined
  return new Map(packages.map(pkg => [pkg.name, pkg.version]))
}

function major(version: string) {
  const parsed = Number(version.match(/^(\d+)/)?.[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

function incompatibleOffenders(current: CompatibilityBundle, previous: CompatibilityBundle) {
  const currentPackages = packageMap(current.nativePackages)
  const previousPackages = packageMap(previous.nativePackages)
  if (!currentPackages || !previousPackages)
    return []

  const offenders: string[] = []
  for (const [name, currentVersion] of currentPackages) {
    const previousVersion = previousPackages.get(name)
    if (!previousVersion)
      continue
    const currentMajor = major(currentVersion)
    const previousMajor = major(previousVersion)
    if (currentMajor !== undefined && previousMajor !== undefined && currentMajor !== previousMajor)
      offenders.push(name)
  }
  return offenders
}

function platformEnabled(channel: CompatibilityChannel, platform: CompatibilityPlatform) {
  return channel[platform] === true
}

function usesNativeCompatibilityStrategy(channel: CompatibilityChannel) {
  return channel.disable_auto_update !== 'version_number'
}

function eventDedupKey(event: {
  app_id: string
  channel_id: number | null
  platform: CompatibilityPlatform
  current_version_id: number | null
  previous_version_id: number | null
  change_occurred_at: string
}) {
  return [event.app_id, event.channel_id, event.platform, event.current_version_id, event.previous_version_id, event.change_occurred_at].join('|')
}

export function decideCompatibilityEvents(input: DecideCompatibilityEventsInput) {
  const { newChannel, currentBundle } = input
  if (!newChannel.public || !usesNativeCompatibilityStrategy(newChannel))
    return []

  const events: CompatibilityEventRecord[] = []
  for (const previous of input.previousDefaults) {
    if (!platformEnabled(newChannel, previous.platform))
      continue
    if (previous.bundle.id === currentBundle.id)
      continue

    const offenders = incompatibleOffenders(currentBundle, previous.bundle)
    if (offenders.length === 0)
      continue

    events.push({
      org_id: newChannel.owner_org,
      app_id: newChannel.app_id,
      source: previous.source,
      platform: previous.platform,
      channel_id: newChannel.id,
      channel_name: newChannel.name,
      current_version_id: currentBundle.id,
      current_version_name: currentBundle.name,
      previous_version_id: previous.bundle.id,
      previous_version_name: previous.bundle.name,
      offenders,
      change_occurred_at: input.changeOccurredAt,
    })
  }
  return events
}

export function decideAutoResolves(unresolved: UnresolvedCompatibilityEvent[], currentDefaults: CurrentDefaultForPlatform[], bundles: Map<number, CompatibilityBundle>) {
  const resolves: AutoResolveDecision[] = []
  for (const event of unresolved) {
    const current = currentDefaults.find(item => item.platform === event.platform)?.bundle
    const previous = bundles.get(event.previous_version_id)
    if (!current || !previous)
      continue
    if (current.id === event.current_version_id)
      continue
    if (incompatibleOffenders(current, previous).length > 0)
      continue

    resolves.push({
      id: event.id,
      note: `Current default ${current.name} is compatible with previous baseline ${previous.name}`,
    })
  }
  return resolves
}

export function processCompatibilityUpdate(input: ProcessCompatibilityUpdateInput) {
  const nextEvents = input.existingEvents.map(event => ({ ...event }))
  const emitted = decideCompatibilityEvents(input)

  for (const event of emitted) {
    const existing = nextEvents.find(candidate => eventDedupKey(candidate) === eventDedupKey(event))
    if (existing) {
      Object.assign(existing, event)
      continue
    }
    nextEvents.push({
      id: nextEvents.length + 1,
      created_at: input.changeOccurredAt,
      resolved_at: null,
      resolved_by: null,
      resolution_kind: null,
      resolution_note: null,
      ...event,
    })
  }

  const resolves = decideAutoResolves(input.unresolvedEvents, input.currentDefaults, input.bundlesById)
  const resolvedAt = input.now?.() ?? new Date().toISOString()
  for (const resolve of resolves) {
    const event = nextEvents.find(candidate => candidate.id === resolve.id && candidate.resolved_at == null)
    if (!event)
      continue
    event.resolved_at = resolvedAt
    event.resolved_by = null
    event.resolution_kind = 'auto_compatible'
    event.resolution_note = resolve.note
  }

  return { events: nextEvents, emitted, resolves }
}

export const compatibilityEventTestUtils = {
  incompatibleOffenders,
  eventDedupKey,
  platforms: PLATFORMS,
}
