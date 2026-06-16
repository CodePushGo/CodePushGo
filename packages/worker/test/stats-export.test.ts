import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
const authHeaders = {
  authorization: 'Bearer test-token',
  'content-type': 'application/json',
}

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  return { app, storage }
}

async function seedStats(ctx: ReturnType<typeof testApp>, appId: string) {
  await ctx.storage.createApp(appId, appId)
  await ctx.app.request('https://api.test/stats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      device_id: 'device-1',
      platform: 'ios',
      version_name: '1.0.0',
      action: 'download_manifest_complete',
      metadata: { file: 'main.js' },
    }),
  }, env)
}

describe('[POST] /private/stats/export', () => {
  it('exports logs as CSV with spreadsheet-friendly headers and trailing newline', async () => {
    const ctx = testApp()
    await seedStats(ctx, 'com.export.csv')

    const response = await ctx.app.request('https://api.test/private/stats/export', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ appId: 'com.export.csv', format: 'csv', limit: 10 }),
    }, env)

    expect(response.status).toBe(200)
    const data = await response.json() as { format: string, filename: string, contentType: string, csv: string, rowCount: number, limit: number }
    expect(data.format).toBe('csv')
    expect(data.filename).toMatch(/codepushgo-logs-com\.export\.csv-/)
    expect(data.contentType).toContain('text/csv')
    expect(data.csv.startsWith('created_at,app_id,device_id,action,version_name,metadata\n')).toBe(true)
    expect(data.csv).toContain('download_manifest_complete')
    expect(data.csv.endsWith('\n')).toBe(true)
    expect(data.rowCount).toBe(1)
    expect(data.limit).toBe(10)
  })

  it('exports logs as JSON with limit metadata', async () => {
    const ctx = testApp()
    await seedStats(ctx, 'com.export.json')

    const response = await ctx.app.request('https://api.test/private/stats/export', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ appId: 'com.export.json', format: 'json', limit: 5 }),
    }, env)

    expect(response.status).toBe(200)
    const data = await response.json() as { format: string, data: Array<{ action: string }>, rowCount: number, limit: number }
    expect(data.format).toBe('json')
    expect(data.data).toHaveLength(1)
    expect(data.data[0]?.action).toBe('download_manifest_complete')
    expect(data.rowCount).toBe(1)
    expect(data.limit).toBe(5)
  })
})
