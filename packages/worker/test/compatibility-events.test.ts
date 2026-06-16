import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

function keyHeaders(key: string) {
  return { capgkey: key, 'content-type': 'application/json' }
}

async function createApp(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string) {
  const response = await app.request('https://api.test/app', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
  }, env)
  expect(response.status).toBe(200)
}

async function createAppKey(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], appId: string) {
  const response = await app.request('https://api.test/apikey', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `${appId}-compat-key`,
      bindings: [{ role_name: 'app_developer', scope_type: 'app', org_id: 'default-org', app_id: appId }],
    }),
  }, env)
  expect(response.status).toBe(200)
  return await response.json() as { key: string }
}

async function insertEvent(storage: ReturnType<typeof testApp>['storage'], appId: string, channelId = 10) {
  return storage.createCompatibilityEvent({
    org_id: 'default-org',
    app_id: appId,
    source: 'default_channel_version_changed',
    platform: 'ios',
    channel_id: channelId,
    channel_name: 'production',
    current_version_id: 200,
    current_version_name: '2.0.0',
    previous_version_id: 100,
    previous_version_name: '1.0.0',
    offenders: ['@react-native/core'],
    change_occurred_at: new Date().toISOString(),
  })
}

describe('[Capgo parity] compatibility_events access', () => {
  it('lets an app member read their app compatibility events but hides them from non-members', async () => {
    const { app, env, storage } = testApp()
    await createApp(app, env, 'com.compat.events.member')
    await createApp(app, env, 'com.compat.events.nonmember')
    const event = await insertEvent(storage, 'com.compat.events.member')
    const memberKey = await createAppKey(app, env, 'com.compat.events.member')
    const nonMemberKey = await createAppKey(app, env, 'com.compat.events.nonmember')

    const memberResponse = await app.request('https://api.test/compatibility_events?app_id=com.compat.events.member', {
      headers: keyHeaders(memberKey.key),
    }, env)
    expect(memberResponse.status).toBe(200)
    const memberRows = await memberResponse.json() as Array<{ id: number }>
    expect(memberRows.some(row => row.id === event.id)).toBe(true)

    const nonMemberResponse = await app.request('https://api.test/compatibility_events?app_id=com.compat.events.member', {
      headers: keyHeaders(nonMemberKey.key),
    }, env)
    expect(nonMemberResponse.status).toBe(200)
    expect(await nonMemberResponse.json()).toEqual([])
  })
})

describe('[Capgo parity] acknowledge compatibility event', () => {
  it('lets an authorized member accept an unresolved event with a note', async () => {
    const { app, env, storage } = testApp()
    await createApp(app, env, 'com.compat.events.ack')
    const event = await insertEvent(storage, 'com.compat.events.ack')
    const memberKey = await createAppKey(app, env, 'com.compat.events.ack')

    const response = await app.request(`https://api.test/compatibility_events/${event.id}/acknowledge`, {
      method: 'POST',
      headers: keyHeaders(memberKey.key),
      body: JSON.stringify({ note: 'Reviewed and confirmed compatible' }),
    }, env)

    expect(response.status).toBe(200)
    const row = await storage.getCompatibilityEvent(event.id)
    expect(row?.resolved_at).not.toBeNull()
    expect(row?.resolution_kind).toBe('accepted')
    expect(row?.resolution_note).toBe('Reviewed and confirmed compatible')
  })

  it('rejects an empty note and leaves the event unresolved', async () => {
    const { app, env, storage } = testApp()
    await createApp(app, env, 'com.compat.events.note')
    const event = await insertEvent(storage, 'com.compat.events.note')
    const memberKey = await createAppKey(app, env, 'com.compat.events.note')

    const response = await app.request(`https://api.test/compatibility_events/${event.id}/acknowledge`, {
      method: 'POST',
      headers: keyHeaders(memberKey.key),
      body: JSON.stringify({ note: '   ' }),
    }, env)

    expect(response.status).toBe(400)
    const row = await storage.getCompatibilityEvent(event.id)
    expect(row?.resolved_at).toBeNull()
    expect(row?.resolution_kind).toBeNull()
  })

  it('is a silent no-op when a non-member tries to accept an event', async () => {
    const { app, env, storage } = testApp()
    await createApp(app, env, 'com.compat.events.owner')
    await createApp(app, env, 'com.compat.events.other')
    const event = await insertEvent(storage, 'com.compat.events.owner')
    const nonMemberKey = await createAppKey(app, env, 'com.compat.events.other')

    const response = await app.request(`https://api.test/compatibility_events/${event.id}/acknowledge`, {
      method: 'POST',
      headers: keyHeaders(nonMemberKey.key),
      body: JSON.stringify({ note: 'Not allowed to do this' }),
    }, env)

    expect(response.status).toBe(200)
    const row = await storage.getCompatibilityEvent(event.id)
    expect(row?.resolved_at).toBeNull()
    expect(row?.resolved_by).toBeNull()
  })

  it('is a silent no-op for an unknown event id', async () => {
    const { app, env } = testApp()
    await createApp(app, env, 'com.compat.events.unknown')
    const memberKey = await createAppKey(app, env, 'com.compat.events.unknown')

    const response = await app.request('https://api.test/compatibility_events/999999999/acknowledge', {
      method: 'POST',
      headers: keyHeaders(memberKey.key),
      body: JSON.stringify({ note: 'Does not exist' }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})

describe('[Capgo parity] compatibility_events cascade', () => {
  it('removes compatibility events when their app is deleted', async () => {
    const { app, env, storage } = testApp()
    await createApp(app, env, 'com.compat.events.cascade')
    await insertEvent(storage, 'com.compat.events.cascade')
    expect(await storage.listCompatibilityEvents('com.compat.events.cascade')).toHaveLength(1)

    const response = await app.request('https://api.test/app/com.compat.events.cascade', {
      method: 'DELETE',
      headers: authHeaders,
    }, env)

    expect(response.status).toBe(200)
    expect(await storage.listCompatibilityEvents('com.compat.events.cascade')).toEqual([])
  })
})
