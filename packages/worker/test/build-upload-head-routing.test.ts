import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

describe('[Capgo parity] build upload HEAD routing', () => {
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env

  function createApp() {
    return createWorkerApp(() => new MemoryStorage())
  }

  it.concurrent('routes HEAD /build/upload/:jobId/* through auth middleware', async () => {
    const response = await createApp().request('/build/upload/test-job/file.zip', {
      method: 'HEAD',
      headers: { 'Tus-Resumable': '1.0.0' },
    }, env)

    expect(response.status).not.toBe(404)
    expect([400, 401]).toContain(response.status)
  })

  it.concurrent('routes HEAD /build/upload/:jobId/* without Tus-Resumable through auth middleware', async () => {
    const response = await createApp().request('/build/upload/test-job/file.zip', { method: 'HEAD' }, env)

    expect(response.status).not.toBe(404)
    expect([400, 401]).toContain(response.status)
  })

  it.concurrent('routes HEAD /build/upload/:jobId through auth middleware', async () => {
    const response = await createApp().request('/build/upload/test-job', {
      method: 'HEAD',
      headers: { 'Tus-Resumable': '1.0.0' },
    }, env)

    expect(response.status).not.toBe(404)
    expect([400, 401]).toContain(response.status)
  })

  it.concurrent('treats GET /build/upload/:jobId/* with Tus-Resumable as a TUS HEAD fallback', async () => {
    const response = await createApp().request('/build/upload/test-job/file.zip', {
      method: 'GET',
      headers: { 'Tus-Resumable': '1.0.0' },
    }, env)

    expect(response.status).not.toBe(404)
    expect([400, 401]).toContain(response.status)
  })

  it.concurrent('treats GET /build/upload/:jobId with Tus-Resumable as a TUS HEAD fallback', async () => {
    const response = await createApp().request('/build/upload/test-job', {
      method: 'GET',
      headers: { 'Tus-Resumable': '1.0.0' },
    }, env)

    expect(response.status).not.toBe(404)
    expect([400, 401]).toContain(response.status)
  })

  it.concurrent('keeps GET /build/upload/:jobId/* as not found', async () => {
    const response = await createApp().request('/build/upload/test-job/file.zip', { method: 'GET' }, env)

    expect(response.status).toBe(404)
  })
})
