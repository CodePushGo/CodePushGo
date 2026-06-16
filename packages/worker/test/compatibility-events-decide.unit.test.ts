import type {
  CompatibilityBundle,
  CurrentDefaultForPlatform,
  DecideCompatibilityEventsInput,
  NativePackage,
  PreviousDefault,
  UnresolvedCompatibilityEvent,
} from '../src/compatibility-events'
import { describe, expect, it } from 'vitest'
import { decideAutoResolves, decideCompatibilityEvents } from '../src/compatibility-events'

const CHANGE_AT = '2026-06-06T12:00:00.000Z'
const PKG_V6: NativePackage[] = [{ name: '@react-native/core', version: '6.0.0' }]
const PKG_V7: NativePackage[] = [{ name: '@react-native/core', version: '7.0.0' }]
const PKG_V7_DUP: NativePackage[] = [{ name: '@react-native/core', version: '7.0.0' }]

function bundle(id: number, name: string, nativePackages: NativePackage[] | null): CompatibilityBundle {
  return { id, name, nativePackages }
}

function newChannel(overrides: Partial<DecideCompatibilityEventsInput['newChannel']> = {}): DecideCompatibilityEventsInput['newChannel'] {
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
    ...overrides,
  }
}

describe('[Capgo parity] decideCompatibilityEvents', () => {
  it('emits an event for a same-channel incompatible version change (Case B)', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel(),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(600, '6.0.0', PKG_V6),
      }],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      org_id: 'org-1',
      app_id: 'com.test.app',
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

  it('emits an event for a default-channel switch (Case A)', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel(),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_changed',
        bundle: bundle(600, '6.0.0', PKG_V6),
      }],
    })

    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('default_channel_changed')
    expect(events[0].previous_version_id).toBe(600)
  })

  it('emits no event when the change is OTA-compatible', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel(),
      currentBundle: bundle(700, '6.0.1', PKG_V6),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(600, '6.0.0', PKG_V6),
      }],
    })

    expect(events).toHaveLength(0)
  })

  it('emits no event under the metadata (version_number) strategy', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel({ disable_auto_update: 'version_number' }),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(600, '6.0.0', PKG_V6),
      }],
    })

    expect(events).toHaveLength(0)
  })

  it('emits no event when the current bundle has no native_packages', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel(),
      currentBundle: bundle(700, '7.0.0', null),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(600, '6.0.0', PKG_V6),
      }],
    })

    expect(events).toHaveLength(0)
  })

  it('emits no event when the previous bundle has no native_packages', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel(),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(600, '6.0.0', []),
      }],
    })

    expect(events).toHaveLength(0)
  })

  it('does not drop a soft-deleted baseline when metadata is present', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel(),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(600, '6.0.0', PKG_V6),
      }],
    })

    expect(events).toHaveLength(1)
  })

  it('fans out one event per default platform (ios + android, not electron)', () => {
    const previous = (platform: PreviousDefault['platform']): PreviousDefault => ({
      platform,
      source: 'default_channel_version_changed',
      bundle: bundle(600, '6.0.0', PKG_V6),
    })

    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel({ ios: true, android: true, electron: false }),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [previous('ios'), previous('android'), previous('electron')],
    })

    expect(events.map(event => event.platform).sort()).toEqual(['android', 'ios'])
  })

  it('emits no event when the channel is not public', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel({ public: false }),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(600, '6.0.0', PKG_V6),
      }],
    })

    expect(events).toHaveLength(0)
  })

  it('emits no event when previous and current are the same bundle id', () => {
    const events = decideCompatibilityEvents({
      changeOccurredAt: CHANGE_AT,
      newChannel: newChannel(),
      currentBundle: bundle(700, '7.0.0', PKG_V7),
      previousDefaults: [{
        platform: 'ios',
        source: 'default_channel_version_changed',
        bundle: bundle(700, '7.0.0', PKG_V7),
      }],
    })

    expect(events).toHaveLength(0)
  })
})

describe('[Capgo parity] decideAutoResolves', () => {
  function unresolved(overrides: Partial<UnresolvedCompatibilityEvent> = {}): UnresolvedCompatibilityEvent {
    return {
      id: 1,
      platform: 'ios',
      previous_version_id: 600,
      previous_version_name: '6.0.0',
      current_version_id: 700,
      ...overrides,
    }
  }

  it('auto-resolves when the current default is now compatible with the baseline', () => {
    const currentDefault: CurrentDefaultForPlatform[] = [{ platform: 'ios', bundle: bundle(800, '6.0.1', PKG_V6) }]
    const bundles = new Map([[600, bundle(600, '6.0.0', PKG_V6)]])

    const resolves = decideAutoResolves([unresolved()], currentDefault, bundles)

    expect(resolves).toHaveLength(1)
    expect(resolves[0].id).toBe(1)
    expect(resolves[0].note).toContain('6.0.1')
    expect(resolves[0].note).toContain('6.0.0')
  })

  it('does NOT auto-resolve on a native-identical successor', () => {
    const currentDefault: CurrentDefaultForPlatform[] = [{ platform: 'ios', bundle: bundle(700, '7.0.0', PKG_V7) }]
    const bundles = new Map([[600, bundle(600, '6.0.0', PKG_V6)]])

    const resolves = decideAutoResolves([unresolved({ current_version_id: 700 })], currentDefault, bundles)

    expect(resolves).toHaveLength(0)
  })

  it('does NOT auto-resolve a different-but-still-incompatible successor', () => {
    const currentDefault: CurrentDefaultForPlatform[] = [{ platform: 'ios', bundle: bundle(900, '7.0.1', PKG_V7_DUP) }]
    const bundles = new Map([[600, bundle(600, '6.0.0', PKG_V6)]])

    const resolves = decideAutoResolves([unresolved({ current_version_id: 700 })], currentDefault, bundles)

    expect(resolves).toHaveLength(0)
  })

  it('does NOT auto-resolve when the current default for the platform is unknown', () => {
    const resolves = decideAutoResolves([unresolved()], [], new Map([[600, bundle(600, '6.0.0', PKG_V6)]]))
    expect(resolves).toHaveLength(0)
  })
})
