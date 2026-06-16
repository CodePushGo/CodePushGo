import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const tusHeaders = {
  'content-type': 'application/offset+octet-stream',
  'Tus-Resumable': '1.0.0',
}

describe('[Capgo parity] files security', () => {
  it('requires auth before creating attachment uploads', async () => {
    const { app, env } = testApp()

    const response = await app.request('/files/upload/attachments', {
      method: 'POST',
      headers: { ...tusHeaders, 'Upload-Length': '4' },
    }, env)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'no_jwt_apikey_or_subkey' })
  })

  it('validates attachment upload length before issuing a TUS URL', async () => {
    const { app, env } = testApp()

    const missingLength = await app.request('/files/upload/attachments', {
      method: 'POST',
      headers: { ...authHeaders, ...tusHeaders },
    }, env)
    expect(missingLength.status).toBe(400)
    expect(await missingLength.json()).toMatchObject({ error: 'invalid_upload_length' })

    const tooLarge = await app.request('/files/upload/attachments', {
      method: 'POST',
      headers: { ...authHeaders, ...tusHeaders, 'Upload-Length': String(1024 * 1024 * 1024 + 1) },
    }, env)
    expect(tooLarge.status).toBe(413)
    expect(await tooLarge.json()).toMatchObject({ error: 'upload_too_large' })
  })

  it('requires auth before reading upload offsets', async () => {
    const { app, env } = testApp()

    const create = await app.request('/files/upload/attachments', {
      method: 'POST',
      headers: { ...authHeaders, ...tusHeaders, 'Upload-Length': '4' },
    }, env)
    expect(create.status).toBe(201)
    const location = create.headers.get('Location')
    expect(location).toBeTruthy()

    const response = await app.request(location!, { method: 'HEAD', headers: { 'Tus-Resumable': '1.0.0' } }, env)
    expect(response.status).toBe(401)
  })
})
