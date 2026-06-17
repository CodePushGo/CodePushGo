import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectReactNativeBundleId, detectReactNativeBundleIds } from '../src/react-native-config'

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function makeProjectDir(name: string) {
  const dir = join(tmpdir(), `codepushgo-cli-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('[Capgo parity] React Native project detection', () => {
  it('selected app directory wins over monorepo root config', () => {
    const dir = makeProjectDir('selected-app')
    try {
      writeJson(join(dir, 'app.json'), {
        expo: {
          ios: { bundleIdentifier: 'com.workspace.root' },
          android: { package: 'com.workspace.root' },
        },
      })

      const appDir = join(dir, 'apps', 'mobile')
      mkdirSync(appDir, { recursive: true })
      writeJson(join(appDir, 'app.json'), {
        expo: {
          ios: { bundleIdentifier: 'com.codepushgo.mobile' },
          android: { package: 'com.codepushgo.mobile.android' },
        },
      })

      expect(existsSync(join(appDir, 'app.json'))).toBe(true)
      expect(detectReactNativeBundleId(appDir, 'ios')).toMatchObject({ bundleId: 'com.codepushgo.mobile', platform: 'ios' })
      expect(detectReactNativeBundleId(appDir, 'android')).toMatchObject({ bundleId: 'com.codepushgo.mobile.android', platform: 'android' })
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rollup config does not override React Native native identifiers', () => {
    const dir = makeProjectDir('rollup-rn')
    try {
      mkdirSync(join(dir, 'android/app'), { recursive: true })
      writeFileSync(join(dir, 'rollup.config.js'), 'export default {}\n')
      writeFileSync(join(dir, 'android/app/build.gradle'), 'android { defaultConfig { applicationId "com.codepushgo.rollup" } }\n')

      expect(detectReactNativeBundleId(dir)).toMatchObject({ bundleId: 'com.codepushgo.rollup', platform: 'android' })
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns all native ids from the selected app directory', () => {
    const dir = makeProjectDir('selected-native-ids')
    try {
      const appDir = join(dir, 'apps', 'mobile')
      mkdirSync(join(appDir, 'android/app'), { recursive: true })
      mkdirSync(join(appDir, 'ios/App.xcodeproj'), { recursive: true })
      writeFileSync(join(appDir, 'android/app/build.gradle'), 'android { defaultConfig { applicationId "com.codepushgo.android" } }\n')
      writeFileSync(join(appDir, 'ios/App.xcodeproj/project.pbxproj'), 'PRODUCT_BUNDLE_IDENTIFIER = com.codepushgo.ios;\n')

      expect(detectReactNativeBundleIds(appDir).map(result => result.bundleId)).toEqual([
        'com.codepushgo.android',
        'com.codepushgo.ios',
      ])
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
