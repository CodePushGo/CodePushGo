import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage, type Env } from '../src/index'

const env: Env = { CODEPUSHGO_API_KEY: 'test-token' }
const authHeaders = { authorization: 'Bearer test-token', 'content-type': 'application/json' }

function postJson(path: string, body: unknown) {
  const app = createWorkerApp(() => new MemoryStorage())
  return app.request(`http://local${path}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(body),
  }, env)
}

async function expectInvalidBody(response: Response) {
  expect(response.status).toBe(400)
  expect(await response.text()).toContain('Invalid body')
}

async function expectRejectedStatsBody(body: Record<string, unknown>, path = '/private/stats') {
  await expectInvalidBody(await postJson(path, { appId: 'com.example.app', ...body }))
}

async function expectRejectedDevicesBody(body: Record<string, unknown>) {
  await expectInvalidBody(await postJson('/private/devices', { appId: 'com.example.app', ...body }))
}

describe('[Capgo parity] private analytics route validation', () => {
  it.each([
    ['malformed deviceIds', { devicesId: ['1) OR 1=1 --'] }],
    ['malformed actions', { actions: ['get', '\' OR 1=1 --'] }],
    ['non-numeric limits', { limit: '1 UNION SELECT 1' }],
    ['decimal limits', { limit: 1.5 }],
    ['boolean limits', { limit: true }],
    ['control characters in search', { search: 'bad\u0000query' }],
    ['invalid rangeStart dates', { rangeStart: 'not-a-date' }],
  ])('rejects %s on /private/stats', async (_label, body) => {
    await expectRejectedStatsBody(body)
  })

  it('accepts backend_refusal on /private/stats', async () => {
    const response = await postJson('/private/stats', {
      appId: 'com.example.app',
      actions: ['backend_refusal'],
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', query: { actions: ['backend_refusal'] } })
  })

  it('normalizes epoch range dates on /private/stats', async () => {
    const response = await postJson('/private/stats', {
      appId: 'com.example.app',
      rangeStart: '1704067200000',
      rangeEnd: 1704153600000,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      query: {
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-02T00:00:00.000Z',
      },
    })
  })

  it('rejects malformed deviceIds on /private/stats/export', async () => {
    await expectRejectedStatsBody({ devicesId: ['1) OR 1=1 --'], format: 'json' }, '/private/stats/export')
  })

  it.each([
    ['malformed deviceIds', { devicesId: ['1) OR 1=1 --'] }],
    ['non-numeric limits', { limit: '1 UNION SELECT 1' }],
    ['decimal limits', { limit: 1.5 }],
    ['boolean limits', { limit: true }],
  ])('rejects %s on /private/devices', async (_label, body) => {
    await expectRejectedDevicesBody(body)
  })
})
