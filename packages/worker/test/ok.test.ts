import { describe, expect, it } from 'vitest'
import { testApp } from './helpers'

describe('[Capgo parity] Worker health endpoints', () => {
  it('serves the public /ok health endpoint without admin auth', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/ok', {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('serves the public /plugin/ok health endpoint for updater clients', async () => {
    const { app, env } = testApp()
    const response = await app.request('https://api.test/plugin/ok', {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
