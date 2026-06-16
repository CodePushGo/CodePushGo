import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const bytes = new TextEncoder().encode('bundle')

async function seedVersionTarget() {
  const ctx = testApp()
  const appId = `com.versionmeta.rpc.${crypto.randomUUID()}`
  await ctx.storage.createRelease({
    appId,
    version: '1.0.0',
    platform: 'ios',
    channel: 'production',
    bytes: bytes.buffer,
    checksum: 'checksum-100',
    size: bytes.byteLength,
    mandatory: false,
    rollout: 100,
  })
  return { ...ctx, appId }
}

async function upsertVersionMeta(ctx: ReturnType<typeof testApp>, body: Record<string, unknown>, headers = authHeaders) {
  return await ctx.app.request('https://api.test/private/version_meta/upsert', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, ctx.env)
}

describe('[Capgo parity] upsert_version_meta RPC authorization', () => {
  it('rejects unauthenticated execution', async () => {
    const ctx = testApp()

    const response = await upsertVersionMeta(ctx, {
      app_id: 'com.versionmeta.anon',
      version_id: 1,
      size: 123456,
    }, { 'content-type': 'application/json' })

    expect(response.status).toBe(401)
  })

  it('returns false for unknown app ids', async () => {
    const ctx = testApp()

    const response = await upsertVersionMeta(ctx, {
      app_id: `com.versionmeta.missing.${crypto.randomUUID()}`,
      version_id: 1,
      size: 123456,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', inserted: false })
  })

  it('returns false for unknown version ids', async () => {
    const ctx = await seedVersionTarget()

    const response = await upsertVersionMeta(ctx, {
      app_id: ctx.appId,
      version_id: 999999999,
      size: 123456,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', inserted: false })
  })

  it('upserts only once per app/version/size sign', async () => {
    const ctx = await seedVersionTarget()

    const first = await upsertVersionMeta(ctx, {
      app_id: ctx.appId,
      version_id: 1,
      size: 123456,
    })
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ status: 'ok', inserted: true })
    expect(ctx.storage.versionMeta).toHaveLength(1)
    expect(ctx.storage.versionMeta[0]).toMatchObject({ appId: ctx.appId, versionId: 1, size: 123456 })

    const duplicate = await upsertVersionMeta(ctx, {
      app_id: ctx.appId,
      version_id: 1,
      size: 123456,
    })
    expect(duplicate.status).toBe(200)
    expect(await duplicate.json()).toEqual({ status: 'ok', inserted: false })
    expect(ctx.storage.versionMeta).toHaveLength(1)

    const negative = await upsertVersionMeta(ctx, {
      app_id: ctx.appId,
      version_id: 1,
      size: -123456,
    })
    expect(negative.status).toBe(200)
    expect(await negative.json()).toEqual({ status: 'ok', inserted: true })
    expect(ctx.storage.versionMeta).toHaveLength(2)
  })
})
