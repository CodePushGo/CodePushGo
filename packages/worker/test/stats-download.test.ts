import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'
import { ALLOWED_STATS_ACTIONS } from '../src/stats-actions'

const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env

async function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  await storage.createApp('com.download.stats', 'Download Stats')
  return { app, storage }
}

async function postStats(app: ReturnType<typeof createWorkerApp>, body: Record<string, unknown>) {
  return app.request('https://api.test/stats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: 'com.download.stats',
      device_id: 'device-download',
      platform: 'ios',
      version_name: '1.0.0',
      ...body,
    }),
  }, env)
}

describe('download Stats Actions', () => {
  it('includes manifest and zip download actions in the allowed action list', () => {
    expect(ALLOWED_STATS_ACTIONS).toEqual(expect.arrayContaining([
      'download_manifest_start',
      'download_manifest_complete',
      'download_zip_start',
      'download_zip_complete',
      'download_manifest_file_fail',
      'download_manifest_checksum_fail',
      'download_manifest_brotli_fail',
    ]))
  })

  it.each([
    'download_manifest_start',
    'download_manifest_complete',
    'download_zip_start',
    'download_zip_complete',
  ])('logs %s with regular version format', async (action) => {
    const { app, storage } = await testApp()
    const response = await postStats(app, { action })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(storage.stats[0]).toMatchObject({ action, version_name: '1.0.0' })
    expect(storage.stats[0]?.version_name).not.toContain(':')
  })

  it.each([
    'download_manifest_file_fail',
    'download_manifest_checksum_fail',
    'download_manifest_brotli_fail',
  ])('logs %s with composite version:filename format', async (action) => {
    const { app, storage } = await testApp()
    const response = await postStats(app, { action, version_name: '1.0.0:assets/main.js' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(storage.stats[0]).toMatchObject({ action, version_name: '1.0.0:assets/main.js' })
  })

  it('stores multiple file failures for the same version without collapsing composite names', async () => {
    const { app, storage } = await testApp()
    for (const file of ['main.js', 'vendor.js', 'styles.css']) {
      const response = await postStats(app, {
        action: 'download_manifest_file_fail',
        version_name: `1.0.0:${file}`,
      })
      expect(response.status).toBe(200)
    }

    expect(storage.stats.map(event => event.version_name)).toEqual([
      '1.0.0:main.js',
      '1.0.0:vendor.js',
      '1.0.0:styles.css',
    ])
  })
})
