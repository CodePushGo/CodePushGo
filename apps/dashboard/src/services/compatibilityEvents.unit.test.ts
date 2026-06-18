import { describe, expect, it, vi } from 'vitest'
import { countUnresolvedCompatibilityGroups, dependencyDiffPath, groupCompatibilityEvents, listCompatibilityEvents, platformLabel, reasonLabel, type CompatibilityEventRow } from './compatibilityEvents'

function event(overrides: Partial<CompatibilityEventRow> = {}): CompatibilityEventRow {
  return {
    id: 1,
    org_id: 'org_1',
    app_id: 'com.test.app',
    source: 'default_channel_version_changed',
    platform: 'ios',
    channel_id: 1,
    channel_name: 'production',
    current_version_id: 10,
    current_version_name: '2.0.0',
    previous_version_id: 9,
    previous_version_name: '1.0.0',
    offenders: [],
    change_occurred_at: '2026-06-18T10:00:00.000Z',
    created_at: '2026-06-18T10:00:01.000Z',
    resolved_at: null,
    resolved_by: null,
    resolution_kind: null,
    resolution_note: null,
    ...overrides,
  }
}

function query(rows: CompatibilityEventRow[], error: unknown = null) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    order: vi.fn(() => Promise.resolve({ data: rows, error })),
  }
  return api
}

describe('[Capgo parity] compatibility events', () => {
  it('groups per-platform rows into one logical compatibility event', () => {
    const rows = [
      event({ id: 1, platform: 'ios' }),
      event({ id: 2, platform: 'android' }),
      event({ id: 3, platform: 'ios', channel_id: 2, channel_name: 'beta' }),
    ]

    const groups = groupCompatibilityEvents(rows)

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ platforms: ['android', 'ios'], resolved: false })
    expect(groups[0].unresolvedEvents).toHaveLength(2)
    expect(groups[1]).toMatchObject({ platforms: ['ios'], resolved: false })
  })

  it('marks a group resolved only when every row is resolved', () => {
    const groups = groupCompatibilityEvents([
      event({ id: 1, platform: 'ios', resolved_at: '2026-06-18T11:00:00.000Z', resolution_kind: 'accepted' }),
      event({ id: 2, platform: 'android', resolved_at: '2026-06-18T11:00:00.000Z', resolution_kind: 'accepted' }),
    ])

    expect(groups[0].resolved).toBe(true)
    expect(reasonLabel(groups[0].representative, 'Ada')).toBe('Accepted by Ada')
  })

  it('keeps labels and dependency diff links compatible with Capgo routes', () => {
    expect(platformLabel('ios')).toBe('iOS')
    expect(dependencyDiffPath('com.test.app', event())).toBe('/app/com.test.app/bundle/10/dependencies?compare=9')
    expect(dependencyDiffPath('com.test.app', event({ previous_version_id: null }))).toBeNull()
  })

  it('loads events from Supabase ordered newest first and counts unresolved groups', async () => {
    const rows = [event({ id: 1, platform: 'ios' }), event({ id: 2, platform: 'android' })]
    const api = query(rows)
    const client = { from: vi.fn(() => api) }

    await expect(listCompatibilityEvents(client, 'com.test.app')).resolves.toEqual(rows)
    await expect(countUnresolvedCompatibilityGroups(client, 'com.test.app')).resolves.toBe(1)

    expect(client.from).toHaveBeenCalledWith('compatibility_events')
    expect(api.select).toHaveBeenCalledWith('id,org_id,app_id,source,platform,channel_id,channel_name,current_version_id,current_version_name,previous_version_id,previous_version_name,offenders,change_occurred_at,created_at,resolved_at,resolved_by,resolution_kind,resolution_note')
    expect(api.eq).toHaveBeenCalledWith('app_id', 'com.test.app')
    expect(api.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
