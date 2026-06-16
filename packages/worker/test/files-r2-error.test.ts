import type { ReleaseRecord } from '@codepushgo/shared'
import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'
import { authHeaders } from './helpers'

class FailingReadStorage extends MemoryStorage {
  failReads = false

  override async getBundle(release: ReleaseRecord) {
    if (this.failReads)
      throw new Error('r2 unavailable')
    return super.getBundle(release)
  }
}

describe('[Capgo parity] files R2 error handling', () => {
  it('returns 503 when bundle object storage read fails', async () => {
    const storage = new FailingReadStorage()
    const app = createWorkerApp(() => storage)
    const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
    const appId = 'com.files.r2.error'
    const version = '1.0.0'

    await app.request('https://api.test/v1/apps', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ appId, owner_org: 'default-org' }),
    }, env)

    const upload = await app.request(`https://api.test/v1/apps/${appId}/bundles`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/zip',
        'x-codepushgo-version': version,
        'x-codepushgo-platform': 'ios',
      },
      body: 'zip bytes',
    }, env)
    expect(upload.status).toBe(201)

    storage.failReads = true
    const download = await app.request(`https://api.test/v1/apps/${appId}/bundles/${version}/download?platform=ios`, {}, env)

    expect(download.status).toBe(503)
    await expect(download.json()).resolves.toMatchObject({ error: 'upstream_unavailable' })
  })
})
