import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('[Capgo parity] /app operations', () => {
  it('creates, lists, reads, updates, and deletes an app by bundle id', async () => {
    const { app, env } = testApp()

    const create = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.example.capgo.app', name: 'Capgo App', owner_org: 'default-org' }),
    }, env)
    expect(create.status).toBe(200)
    expect(await create.json()).toMatchObject({ status: 'ok', app_id: 'com.example.capgo.app', name: 'Capgo App' })

    const list = await app.request('https://api.test/app', { headers: authHeaders }, env)
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual(expect.arrayContaining([expect.objectContaining({ app_id: 'com.example.capgo.app' })]))

    const read = await app.request('https://api.test/app/com.example.capgo.app', { headers: authHeaders }, env)
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ app_id: 'com.example.capgo.app', name: 'Capgo App' })

    const update = await app.request('https://api.test/app/com.example.capgo.app', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Updated App' }),
    }, env)
    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({ status: 'ok', name: 'Updated App' })

    const remove = await app.request('https://api.test/app/com.example.capgo.app', {
      method: 'DELETE',
      headers: authHeaders,
    }, env)
    expect(remove.status).toBe(200)
    expect(await remove.json()).toEqual({ status: 'ok' })

    const afterDelete = await app.request('https://api.test/app/com.example.capgo.app', { headers: authHeaders }, env)
    expect(afterDelete.status).toBe(401)
  })

  it('rejects invalid app ids', async () => {
    const { app, env } = testApp()

    const response = await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'invalid_app' }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_app_id' })
  })
})
