import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

const authHeaders = { authorization: 'Bearer test-token' }

function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
  return { app, env }
}

async function uploadVersion(version: string) {
  const { app, env } = testApp()
  return app.request('https://api.test/v1/apps/com.bundle.semver/bundles', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'x-codepushgo-version': version,
      'x-codepushgo-platform': 'ios',
      'x-codepushgo-checksum': 'abc123',
    },
    body: new TextEncoder().encode('bundle'),
  }, env)
}

describe('bundle semver validation', () => {
  it('accepts strict semver versions without a leading v', async () => {
    for (const version of [
      '1.0.0',
      '0.0.0',
      '10.20.30',
      '1.0.0-alpha.1',
      '1.0.0-alpha-.-beta',
      '1.0.0+build.1',
      '1.0.0-beta.2+build.123',
      `1.0.0-alpha.${'a'.repeat(100)}`,
    ]) {
      const response = await uploadVersion(version)
      expect(response.status, version).toBe(201)
      expect(await response.json(), version).toMatchObject({ release: { version } })
    }
  })

  it('rejects malformed versions with invalid_version_format', async () => {
    for (const version of [
      'v1.0.0',
      'V1.0.0',
      '1',
      '1.2',
      '1.2.3.4',
      '01.0.0',
      '1.02.0',
      '1.0.03',
      '1.0.0-',
      '1.0.0-..',
      '1.0.0-01',
      '1.0.0+',
      '1.0.0+_build',
      '1.0.0!',
      '>=1.0.0',
      'latest',
    ]) {
      const response = await uploadVersion(version)
      expect(response.status, version).toBe(400)
      expect(await response.json(), version).toMatchObject({ error: 'invalid_version_format' })
    }
  })
})
