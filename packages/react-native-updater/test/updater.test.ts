import { afterEach, describe, expect, it } from 'vitest'
import { clearCodePushGoConfig, configureCodePushGo, createCodePushGoClient, getCodePushGoBundleId, startCodePushGo, type FetchLike, type StorageAdapter } from '../src/index'

class TestStorage implements StorageAdapter {
  values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function response(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

type RuntimeWithRequire = typeof globalThis & { require?: (name: string) => unknown }

function mockReactNativeBundleId(bundleId: string) {
  const runtime = globalThis as RuntimeWithRequire
  const previousRequire = runtime.require
  runtime.require = (name: string) => {
    if (name !== 'react-native')
      return previousRequire?.(name)

    return {
      NativeModules: {
        CodePushGo: { bundleId },
        PlatformConstants: {
          BundleIdentifier: bundleId,
          applicationId: bundleId,
        },
      },
      Platform: {
        constants: {
          BundleIdentifier: bundleId,
          applicationId: bundleId,
        },
      },
    }
  }

  return () => {
    if (previousRequire)
      runtime.require = previousRequire
    else
      delete runtime.require
  }
}

afterEach(() => {
  clearCodePushGoConfig()
})
describe('React Native updater client', () => {
  it('checks for updates with CodePushGo device payload', async () => {
    const requests: Array<{ url: string, body?: unknown }> = []
    const fetcher: FetchLike = async (input, init) => {
      requests.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return response({ status: 'ok', available: false, message: 'No update available' })
    }

    const client = createCodePushGoClient({
      appId: 'com.example.app',
      endpoint: 'https://api.test/',
      platform: 'ios',
      currentVersion: '1.0.0',
      deviceId: 'device-1',
      fetch: fetcher,
    })

    const update = await client.checkForUpdate()
    expect(update.available).toBe(false)
    expect(requests[0]).toMatchObject({
      url: 'https://api.test/updates',
      body: {
        app_id: 'com.example.app',
        bundle_id: 'com.example.app',
        device_id: 'device-1',
        platform: 'ios',
        version_name: '1.0.0',
        defaultChannel: 'production',
      },
    })
  })

  it('downloads and remembers a pending update', async () => {
    const storage = new TestStorage()
    const calls: string[] = []
    const fetcher: FetchLike = async (input, init) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`)
      if (String(input).endsWith('/stats'))
        return response({ status: 'ok' })
      return new Response(new TextEncoder().encode('bundle'))
    }

    const client = createCodePushGoClient({
      appId: 'com.example.app',
      endpoint: 'https://api.test',
      platform: 'android',
      currentVersion: '1.0.0',
      deviceId: 'device-1',
      storage,
      fetch: fetcher,
    })

    const update = {
      status: 'ok' as const,
      available: true as const,
      version: '1.0.1',
      url: 'https://api.test/download.zip',
      checksum: 'abc123',
      size: 6,
      channel: 'production',
      mandatory: false,
      rollout: 100,
    }

    const downloaded = await client.downloadUpdate(update)
    expect(new TextDecoder().decode(downloaded.bytes)).toBe('bundle')
    expect(await client.getPendingUpdate()).toMatchObject({ version: '1.0.1' })
    expect(calls).toEqual([
      'POST https://api.test/stats',
      'GET https://api.test/download.zip',
      'POST https://api.test/stats',
    ])
  })

  it('uses runtime bundleId config as the app identity', async () => {
    const requests: Array<{ body?: unknown }> = []
    const fetcher: FetchLike = async (_input, init) => {
      requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return response({ status: 'ok', available: false, message: 'No update available' })
    }

    configureCodePushGo({ bundleId: 'com.example.runtime', endpoint: 'https://api.test' })

    const client = createCodePushGoClient({
      platform: 'android',
      currentVersion: '1.0.0',
      deviceId: 'device-1',
      fetch: fetcher,
    })

    await client.checkForUpdate()
    expect(requests[0]?.body).toMatchObject({
      app_id: 'com.example.runtime',
      bundle_id: 'com.example.runtime',
    })
  })

  it('prefers the native bundle id over stale runtime app identity config', async () => {
    const restore = mockReactNativeBundleId('com.example.nativewins')
    const requests: Array<{ body?: unknown }> = []
    const fetcher: FetchLike = async (_input, init) => {
      requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return response({ status: 'ok', available: false, message: 'No update available' })
    }

    try {
      configureCodePushGo({ appId: 'com.example.stale', bundleId: 'com.example.stale', endpoint: 'https://api.test' })

      const client = createCodePushGoClient({
        platform: 'ios',
        currentVersion: '1.0.0',
        deviceId: 'device-1',
        fetch: fetcher,
      })

      await client.checkForUpdate()
      expect(requests[0]?.body).toMatchObject({
        app_id: 'com.example.nativewins',
        bundle_id: 'com.example.nativewins',
      })
    }
    finally {
      restore()
    }
  })

  it('uses the global native bundle id when no explicit app id is passed', async () => {
    const runtime = globalThis as typeof globalThis & { __CODEPUSHGO_BUNDLE_ID__?: string }
    runtime.__CODEPUSHGO_BUNDLE_ID__ = 'com.example.native'
    configureCodePushGo({ endpoint: 'https://api.test' })
    const requests: Array<{ body?: unknown }> = []
    const fetcher: FetchLike = async (_input, init) => {
      requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return response({ status: 'ok', available: false, message: 'No update available' })
    }

    expect(getCodePushGoBundleId('ios')).toBe('com.example.native')

    const client = createCodePushGoClient({
      platform: 'ios',
      currentVersion: '1.0.0',
      deviceId: 'device-1',
      fetch: fetcher,
    })

    await client.checkForUpdate()
    expect(requests[0]?.body).toMatchObject({
      app_id: 'com.example.native',
      bundle_id: 'com.example.native',
    })
  })

  it('uses React Native runtime constants as the app identity by default', async () => {
    const restore = mockReactNativeBundleId('com.example.constants')
    const requests: Array<{ body?: unknown }> = []
    const fetcher: FetchLike = async (_input, init) => {
      requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return response({ status: 'ok', available: false, message: 'No update available' })
    }

    try {
      configureCodePushGo({ endpoint: 'https://api.test' })
      expect(getCodePushGoBundleId('ios')).toBe('com.example.constants')

      const client = createCodePushGoClient({
        platform: 'ios',
        currentVersion: '1.0.0',
        deviceId: 'device-1',
        fetch: fetcher,
      })

      await client.checkForUpdate()
      expect(requests[0]?.body).toMatchObject({
        app_id: 'com.example.constants',
        bundle_id: 'com.example.constants',
      })
    }
    finally {
      restore()
    }
  })

  it('starts with auto update enabled by default and downloads the available bundle', async () => {
    const restore = mockReactNativeBundleId('com.example.autostart')
    const calls: Array<{ url: string, method: string, body?: unknown }> = []
    const storage = new TestStorage()
    const fetcher: FetchLike = async (input, init) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (url.endsWith('/updates')) {
        return response({
          status: 'ok',
          available: true,
          version: '1.0.1',
          url: 'https://api.test/bundle.zip',
          checksum: 'abc123',
          size: 6,
          channel: 'production',
          mandatory: false,
          rollout: 100,
        })
      }
      if (url.endsWith('/stats'))
        return response({ status: 'ok' })
      return new Response(new TextEncoder().encode('bundle'))
    }

    try {
      const started = await startCodePushGo({
        endpoint: 'https://api.test',
        platform: 'android',
        currentVersion: '1.0.0',
        deviceId: 'device-1',
        storage,
        fetch: fetcher,
      })

      expect(started.update).toMatchObject({ available: true, version: '1.0.1' })
      expect(started.downloaded && new TextDecoder().decode(started.downloaded.bytes)).toBe('bundle')
      expect(await started.client.getPendingUpdate()).toMatchObject({ version: '1.0.1' })
      expect(calls[0]).toMatchObject({
        url: 'https://api.test/updates',
        method: 'POST',
        body: {
          app_id: 'com.example.autostart',
          bundle_id: 'com.example.autostart',
          defaultChannel: 'production',
        },
      })
    }
    finally {
      restore()
    }
  })

  it('sends channel only when checkForUpdate asks for an override', async () => {
    const requests: Array<{ body?: unknown }> = []
    const fetcher: FetchLike = async (_input, init) => {
      requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return response({ status: 'ok', available: false, message: 'No update available' })
    }

    const client = createCodePushGoClient({
      appId: 'com.example.app',
      endpoint: 'https://api.test',
      platform: 'android',
      currentVersion: '1.0.0',
      channel: 'production',
      deviceId: 'device-1',
      fetch: fetcher,
    })

    await client.checkForUpdate({ channel: 'beta' })
    expect(requests[0]?.body).toMatchObject({
      defaultChannel: 'production',
      channel: 'beta',
    })
  })
})
