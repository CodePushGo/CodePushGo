import { describe, expect, it } from 'vitest'
import { authHeaders, testApp } from './helpers'

const TUS_VERSION = '1.0.0'

function generateTestData(size: number): Uint8Array {
  const data = new Uint8Array(size)
  for (let index = 0; index < size; index += 1)
    data[index] = index % 256
  return data
}

async function createTusUpload(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], uploadLength: number) {
  const filename = btoa(`orgs/default-org/apps/com.tus.test/test-${Date.now()}.zip`)
  const response = await app.request('/files/upload/attachments', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Tus-Resumable': TUS_VERSION,
      'Upload-Length': String(uploadLength),
      'Upload-Metadata': `filename ${filename}`,
      'Content-Type': 'application/offset+octet-stream',
    },
  }, env)
  return { response, uploadUrl: response.headers.get('Location') ?? '' }
}

async function uploadChunk(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], uploadUrl: string, data: Uint8Array, offset: number) {
  return await app.request(uploadUrl, {
    method: 'PATCH',
    headers: {
      ...authHeaders,
      'Tus-Resumable': TUS_VERSION,
      'Upload-Offset': String(offset),
      'Content-Type': 'application/offset+octet-stream',
    },
    body: data,
  }, env)
}

async function checkUploadProgress(app: ReturnType<typeof testApp>['app'], env: ReturnType<typeof testApp>['env'], uploadUrl: string) {
  const response = await app.request(uploadUrl, {
    method: 'HEAD',
    headers: {
      ...authHeaders,
      'Tus-Resumable': TUS_VERSION,
    },
  }, env)
  return {
    length: Number(response.headers.get('Upload-Length')),
    offset: Number(response.headers.get('Upload-Offset')),
    response,
  }
}

describe('[Capgo parity] tus upload protocol tests', () => {
  it('returns file upload config for self-hosted Worker deployments', async () => {
    const { app, env } = testApp()
    const response = await app.request('/files/config', {}, env)
    const config = await response.json() as { TUSUpload: boolean, maxUploadLength: number }

    expect(response.status).toBe(200)
    expect(config.TUSUpload).toBe(true)
    expect(config.maxUploadLength).toBeGreaterThan(0)
  })

  it('returns TUS capabilities for file and build upload OPTIONS discovery', async () => {
    const { app, env } = testApp()

    for (const path of ['/files/upload/attachments', '/build/upload/test-job', '/build/upload/test-job/any-file.zip']) {
      const response = await app.request(path, { method: 'OPTIONS' }, env)
      expect(response.status, path).toBe(204)
      expect(response.headers.get('Tus-Resumable')).toBe(TUS_VERSION)
      expect(response.headers.get('Tus-Version')).toBe(TUS_VERSION)
      expect(response.headers.get('Tus-Extension')).toContain('creation')
    }
  })

  it('creates uploads with valid metadata and rejects missing authentication', async () => {
    const { app, env } = testApp()
    const { response, uploadUrl } = await createTusUpload(app, env, 1024)

    expect(response.status).toBe(201)
    expect(uploadUrl).toBeTruthy()
    expect(response.headers.get('Tus-Resumable')).toBe(TUS_VERSION)

    const unauthenticated = await app.request('/files/upload/attachments', {
      method: 'POST',
      headers: {
        'Tus-Resumable': TUS_VERSION,
        'Upload-Length': '1024',
        'Upload-Metadata': `filename ${btoa('orgs/default-org/apps/com.tus.test/test.zip')}`,
      },
    }, env)
    expect([400, 401]).toContain(unauthenticated.status)
  })

  it('uploads chunks sequentially and exposes resumable HEAD progress', async () => {
    const { app, env } = testApp()
    const totalSize = 1536
    const chunkSize = 512
    const testData = generateTestData(totalSize)
    const { response, uploadUrl } = await createTusUpload(app, env, totalSize)

    expect(response.status).toBe(201)
    expect(uploadUrl).toBeTruthy()

    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const chunk = testData.slice(offset, offset + chunkSize)
      const patchResponse = await uploadChunk(app, env, uploadUrl, chunk, offset)
      expect(patchResponse.status).toBe(204)
      expect(patchResponse.headers.get('Upload-Offset')).toBe(String(offset + chunk.length))
    }

    const progress = await checkUploadProgress(app, env, uploadUrl)
    expect(progress.response.status).toBe(200)
    expect(progress.offset).toBe(totalSize)
    expect(progress.length).toBe(totalSize)
  })

  it('rejects mismatched offsets with the current offset so clients can resume', async () => {
    const { app, env } = testApp()
    const { uploadUrl } = await createTusUpload(app, env, 1024)
    await uploadChunk(app, env, uploadUrl, generateTestData(256), 0)

    const mismatch = await uploadChunk(app, env, uploadUrl, generateTestData(128), 0)

    expect(mismatch.status).toBe(409)
    expect(mismatch.headers.get('Upload-Offset')).toBe('256')
    expect(mismatch.headers.get('Tus-Resumable')).toBe(TUS_VERSION)
  })
})
