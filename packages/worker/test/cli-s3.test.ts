import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

describe('upload_link', () => {
  it('returns a valid Worker upload URL for R2 direct uploads', async () => {
    const { app, env } = testApp()
    const appId = 'com.cli.s3.upload'
    const fileId = '1.0.42'
    await app.request('https://api.test/app', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: appId, owner_org: 'default-org' }),
    }, env)

    const res = await app.request('https://api.test/upload_link', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: appId, name: fileId }),
    }, env)
    expect(res.status).toBe(200)
    const data = await res.json() as { url: string, path: string }
    expect(data.url).toContain(`orgs/default-org/apps/${appId}/${fileId}.zip`)
    expect(data.path).toBe(`orgs/default-org/apps/${appId}/${fileId}.zip`)

    const upload = await app.request(data.url, {
      method: 'PUT',
      headers: { 'content-type': 'application/zip' },
      body: 'Hello World',
    }, env)
    expect(upload.status).toBe(200)
    await expect(upload.json()).resolves.toMatchObject({ status: 'ok', size: 11 })
  })

  it('fails without auth', async () => {
    const { app, env } = testApp()
    const res = await app.request('https://api.test/upload_link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileId: 'test.txt' }),
    }, env)

    expect(res.status).toBe(401)
  })

  it('fails with invalid fileId', async () => {
    const { app, env } = testApp()
    const res = await app.request('https://api.test/upload_link', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_id: 'com.cli.s3.invalid', fileId: '' }),
    }, env)

    expect(res.status).toBe(400)
  })
})
