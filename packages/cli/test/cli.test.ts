import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { CodePushGoApi } from '../src/api'
import { zipDirectory } from '../src/archive'
import { handleInit, requireValidReleaseVersion, resolveAppId } from '../src/commands'
import { reactNativeBundleArgs } from '../src/react-native'

describe('CLI React Native helpers', () => {
  it('builds bunx react-native bundle arguments', () => {
    expect(reactNativeBundleArgs({
      platform: 'ios',
      entryFile: 'index.js',
      outDir: 'dist/codepushgo/ios',
      sourcemap: true,
    })).toEqual([
      'react-native',
      'bundle',
      '--platform', 'ios',
      '--entry-file', 'index.js',
      '--bundle-output', 'dist/codepushgo/ios/index.ios.bundle',
      '--assets-dest', 'dist/codepushgo/ios/assets',
      '--dev', 'false',
      '--sourcemap-output', 'dist/codepushgo/ios/index.ios.bundle.map',
    ])
  })

  it('zips React Native bundle directories with posix paths', async () => {
    const root = join(tmpdir(), `codepushgo-${Date.now()}`)
    await mkdir(join(root, 'assets', 'images'), { recursive: true })
    await writeFile(join(root, 'index.ios.bundle'), 'bundle')
    await writeFile(join(root, 'assets', 'images', 'logo.png'), 'image')

    const zipped = await zipDirectory(root)
    const files = unzipSync(zipped)
    expect(strFromU8(files['index.ios.bundle']!)).toBe('bundle')
    expect(strFromU8(files['assets/images/logo.png']!)).toBe('image')
  })

  it('creates apps with the React Native bundle identity aliases', async () => {
    const requests: Array<{ url: string, body?: unknown }> = []
    const api = new CodePushGoApi({
      endpoint: 'https://api.test',
      token: 'test-token',
      fetch: (async (input, init) => {
        requests.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined })
        return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'content-type': 'application/json' } })
      }) as typeof fetch,
    })

    await api.createApp('com.example.bundle', 'Example')
    expect(requests).toEqual([{
      url: 'https://api.test/v1/apps',
      body: {
        appId: 'com.example.bundle',
        app_id: 'com.example.bundle',
        bundle_id: 'com.example.bundle',
        name: 'Example',
        owner_org: 'default-org',
      },
    }])
  })

  it('resolves the app id from the detected React Native bundle id by default', async () => {
    const root = join(tmpdir(), `codepushgo-rn-app-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const previousCwd = process.cwd()
    const previousEnv = process.env.CODEPUSHGO_APP_ID
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'app.json'), JSON.stringify({
      expo: {
        ios: { bundleIdentifier: 'com.example.detected' },
      },
    }))

    try {
      delete process.env.CODEPUSHGO_APP_ID
      process.chdir(root)
      await expect(resolveAppId({ platform: 'ios' })).resolves.toBe('com.example.detected')
    }
    finally {
      process.chdir(previousCwd)
      if (previousEnv === undefined)
        delete process.env.CODEPUSHGO_APP_ID
      else
        process.env.CODEPUSHGO_APP_ID = previousEnv
    }
  })

  it('auto-connects init with the detected React Native bundle id by default', async () => {
    const root = join(tmpdir(), `codepushgo-rn-init-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const previousCwd = process.cwd()
    const previousToken = process.env.CODEPUSHGO_TOKEN
    const previousFetch = globalThis.fetch
    const previousLog = console.log
    const requests: Array<{ url: string, body?: unknown, authorization?: string | null }> = []
    const logs: string[] = []
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'app.json'), JSON.stringify({
      expo: {
        ios: { bundleIdentifier: 'com.example.detected' },
      },
    }))

    try {
      process.chdir(root)
      process.env.CODEPUSHGO_TOKEN = 'test-token'
      console.log = (message?: unknown) => {
        logs.push(String(message))
      }
      globalThis.fetch = (async (input, init) => {
        requests.push({
          url: String(input),
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
          authorization: init?.headers instanceof Headers ? init.headers.get('authorization') : undefined,
        })
        return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'content-type': 'application/json' } })
      }) as typeof fetch

      await handleInit({ platform: 'ios', endpoint: 'https://api.test' })

      expect(requests).toEqual([{
        url: 'https://api.test/v1/apps',
        authorization: 'Bearer test-token',
        body: {
          appId: 'com.example.detected',
          app_id: 'com.example.detected',
          bundle_id: 'com.example.detected',
          name: 'com.example.detected',
          owner_org: 'default-org',
        },
      }])
      const output = JSON.parse(logs.at(-1) ?? '{}')
      expect(output).toMatchObject({ status: 'ok', bundleId: 'com.example.detected', connected: true })
    }
    finally {
      process.chdir(previousCwd)
      if (previousToken === undefined)
        delete process.env.CODEPUSHGO_TOKEN
      else
        process.env.CODEPUSHGO_TOKEN = previousToken
      globalThis.fetch = previousFetch
      console.log = previousLog
    }
  })

  it('prefers the detected React Native bundle id over stale config or env defaults', async () => {
    const root = join(tmpdir(), `codepushgo-rn-precedence-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const previousCwd = process.cwd()
    const previousEnv = process.env.CODEPUSHGO_APP_ID
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'app.json'), JSON.stringify({
      expo: {
        ios: { bundleIdentifier: 'com.example.detected' },
      },
    }))
    await writeFile(join(root, 'codepushgo.config.json'), JSON.stringify({ appId: 'com.example.stale' }))

    try {
      process.env.CODEPUSHGO_APP_ID = 'com.example.env'
      process.chdir(root)
      await expect(resolveAppId({ platform: 'ios' })).resolves.toBe('com.example.detected')
    }
    finally {
      process.chdir(previousCwd)
      if (previousEnv === undefined)
        delete process.env.CODEPUSHGO_APP_ID
      else
        process.env.CODEPUSHGO_APP_ID = previousEnv
    }
  })

  it('rejects invalid detected or configured app ids', async () => {
    const previousEnv = process.env.CODEPUSHGO_APP_ID
    const previousCwd = process.cwd()
    const root = join(tmpdir(), `codepushgo-invalid-app-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(root, { recursive: true })

    try {
      process.chdir(root)
      process.env.CODEPUSHGO_APP_ID = 'invalid-app-id'
      await expect(resolveAppId({ platform: 'ios' })).rejects.toThrow('reverse-domain')
    }
    finally {
      process.chdir(previousCwd)
      if (previousEnv === undefined)
        delete process.env.CODEPUSHGO_APP_ID
      else
        process.env.CODEPUSHGO_APP_ID = previousEnv
    }
  })

  it('uses strict semver for upload and release versions', () => {
    expect(requireValidReleaseVersion('1.0.0-alpha+build.1')).toBe('1.0.0-alpha+build.1')
    for (const version of ['v1.0.0', '1.0', '01.0.0', '1.0.0-01', 'latest'])
      expect(() => requireValidReleaseVersion(version), version).toThrow('strict semver')
  })
})
