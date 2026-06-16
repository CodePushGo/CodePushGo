import type { CompatibilityBundle, CompatibilityChannel, NativePackage, StoredCompatibilityEvent } from '../src/compatibility-events'
import { beforeEach, describe, expect, it } from 'vitest'
import { processCompatibilityUpdate } from '../src/compatibility-events'

const PKG_V6: NativePackage[] = [{ name: '@react-native/core', version: '6.0.0' }]
const PKG_V7: NativePackage[] = [{ name: '@react-native/core', version: '7.0.0' }]

const appVersions: Record<number, CompatibilityBundle> = {
  600: { id: 600, name: '6.0.0', nativePackages: PKG_V6 },
  700: { id: 700, name: '7.0.0', nativePackages: PKG_V7 },
}

let eventStore: StoredCompatibilityEvent[] = []

function channelRecord(overrides: Partial<CompatibilityChannel> & { updated_at?: string } = {}) {
  return {
    id: 101,
    app_id: 'com.test.app',
    owner_org: 'org-1',
    name: 'production',
    version: 700,
    public: true,
    ios: true,
    android: false,
    electron: false,
    disable_auto_update: 'major',
    updated_at: 't',
    ...overrides,
  }
}

function runUpdate(record: ReturnType<typeof channelRecord>, oldRecord: ReturnType<typeof channelRecord>) {
  const currentBundle = appVersions[record.version]
  const previousBundle = appVersions[oldRecord.version]
  const previousDefaults = record.version !== oldRecord.version && previousBundle
    ? [{ platform: 'ios' as const, source: 'default_channel_version_changed' as const, bundle: previousBundle }]
    : []
  if (record.android && previousBundle)
    previousDefaults.push({ platform: 'android', source: 'default_channel_version_changed', bundle: previousBundle })
  if (record.electron && previousBundle)
    previousDefaults.push({ platform: 'electron', source: 'default_channel_version_changed', bundle: previousBundle })

  const result = processCompatibilityUpdate({
    changeOccurredAt: record.updated_at,
    newChannel: record,
    currentBundle,
    previousDefaults,
    unresolvedEvents: eventStore
      .filter(event => event.resolved_at == null)
      .map(event => ({
        id: event.id,
        platform: event.platform,
        current_version_id: event.current_version_id,
        previous_version_id: event.previous_version_id,
        previous_version_name: event.previous_version_name,
      })),
    currentDefaults: [
      { platform: 'ios', bundle: currentBundle },
      ...(record.android ? [{ platform: 'android' as const, bundle: currentBundle }] : []),
      ...(record.electron ? [{ platform: 'electron' as const, bundle: currentBundle }] : []),
    ],
    bundlesById: new Map(Object.entries(appVersions).map(([id, bundle]) => [Number(id), bundle])),
    existingEvents: eventStore,
    now: () => '2026-06-03T00:00:00.000Z',
  })
  eventStore = result.events
  return result
}

describe('[Capgo parity] on_channel_update compatibility events', () => {
  beforeEach(() => {
    eventStore = []
    delete appVersions[650]
    delete appVersions[800]
  })

  it('records one incompatible event on a default-channel version change (Case B)', () => {
    runUpdate(channelRecord({ version: 700 }), channelRecord({ version: 600 }))

    expect(eventStore).toHaveLength(1)
    expect(eventStore[0]).toMatchObject({
      app_id: 'com.test.app',
      org_id: 'org-1',
      source: 'default_channel_version_changed',
      platform: 'ios',
      channel_id: 101,
      channel_name: 'production',
      current_version_id: 700,
      current_version_name: '7.0.0',
      previous_version_id: 600,
      previous_version_name: '6.0.0',
      offenders: ['@react-native/core'],
    })
  })

  it('is idempotent: re-POSTing the same payload does not duplicate the row', () => {
    const record = channelRecord({ version: 700 })
    const oldRecord = channelRecord({ version: 600 })

    runUpdate(record, oldRecord)
    runUpdate(record, oldRecord)

    expect(eventStore).toHaveLength(1)
  })

  it('preserves a resolved row across a redelivery', () => {
    const record = channelRecord({ version: 700 })
    const oldRecord = channelRecord({ version: 600 })

    runUpdate(record, oldRecord)
    Object.assign(eventStore[0], {
      resolved_at: '2026-06-03T00:00:00.000Z',
      resolved_by: 'user-9',
      resolution_kind: 'accepted',
      resolution_note: 'reviewed',
    })
    runUpdate(record, oldRecord)

    expect(eventStore).toHaveLength(1)
    expect(eventStore[0]).toMatchObject({
      resolved_at: '2026-06-03T00:00:00.000Z',
      resolved_by: 'user-9',
      resolution_kind: 'accepted',
      resolution_note: 'reviewed',
    })
  })

  it('creates a NEW unresolved row when the same transition re-occurs later', () => {
    runUpdate(channelRecord({ version: 700 }), channelRecord({ version: 600 }))
    Object.assign(eventStore[0], {
      resolved_at: '2026-06-03T00:00:00.000Z',
      resolved_by: 'user-9',
      resolution_kind: 'accepted',
      resolution_note: 'reviewed',
    })

    runUpdate(channelRecord({ version: 700, updated_at: 't2' }), channelRecord({ version: 600, updated_at: 't' }))

    expect(eventStore).toHaveLength(2)
    expect(eventStore[0].resolution_kind).toBe('accepted')
    expect(eventStore[1].resolved_at).toBeNull()
    expect(eventStore[1].change_occurred_at).toBe('t2')
  })

  it('records no event when the version change is OTA-compatible', () => {
    appVersions[650] = { id: 650, name: '6.0.1', nativePackages: PKG_V6 }

    runUpdate(channelRecord({ version: 650 }), channelRecord({ version: 600 }))

    expect(eventStore).toHaveLength(0)
  })

  it('fans out one event per default platform (ios + android, not electron)', () => {
    runUpdate(
      channelRecord({ version: 700, ios: true, android: true, electron: false }),
      channelRecord({ version: 600, ios: true, android: true, electron: false }),
    )

    expect(eventStore).toHaveLength(2)
    expect(eventStore.map(event => event.platform).sort()).toEqual(['android', 'ios'])
    expect(eventStore.some(event => event.platform === 'electron')).toBe(false)
  })

  it('auto-resolves an unresolved event when the default reverts to a compatible bundle', () => {
    appVersions[800] = { id: 800, name: '6.0.1', nativePackages: PKG_V6 }
    eventStore.push({
      id: 1,
      app_id: 'com.test.app',
      org_id: 'org-1',
      source: 'default_channel_version_changed',
      channel_id: 101,
      channel_name: 'production',
      platform: 'ios',
      current_version_id: 700,
      current_version_name: '7.0.0',
      previous_version_id: 600,
      previous_version_name: '6.0.0',
      offenders: ['@react-native/core'],
      change_occurred_at: 't',
      resolved_at: null,
      resolved_by: null,
      resolution_kind: null,
      resolution_note: null,
    })

    runUpdate(channelRecord({ version: 800 }), channelRecord({ version: 800 }))

    expect(eventStore).toHaveLength(1)
    expect(eventStore[0].resolved_at).toBe('2026-06-03T00:00:00.000Z')
    expect(eventStore[0].resolution_kind).toBe('auto_compatible')
    expect(eventStore[0].resolved_by).toBeNull()
  })
})
