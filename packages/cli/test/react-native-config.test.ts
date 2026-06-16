import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { detectReactNativeBundleId, detectReactNativeBundleIds } from '../src/react-native-config'

async function tempProject(name: string) {
  const root = join(tmpdir(), `codepushgo-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

describe('React Native bundle id detection', () => {
  it('detects Expo bundle identifiers from app.json', async () => {
    const root = await tempProject('expo')
    await writeFile(join(root, 'app.json'), JSON.stringify({
      expo: {
        ios: { bundleIdentifier: 'com.example.ios' },
        android: { package: 'com.example.android' },
      },
    }))

    expect(detectReactNativeBundleId(root, 'ios')).toMatchObject({ bundleId: 'com.example.ios', platform: 'ios' })
    expect(detectReactNativeBundleId(root, 'android')).toMatchObject({ bundleId: 'com.example.android', platform: 'android' })
  })

  it('detects Android applicationId from Gradle', async () => {
    const root = await tempProject('android')
    await mkdir(join(root, 'android/app'), { recursive: true })
    await writeFile(join(root, 'android/app/build.gradle'), `android {\n defaultConfig { applicationId "com.example.app" }\n}`)

    expect(detectReactNativeBundleId(root)).toMatchObject({ bundleId: 'com.example.app', platform: 'android' })
  })

  it('detects iOS bundle id from pbxproj', async () => {
    const root = await tempProject('ios')
    await mkdir(join(root, 'ios/App.xcodeproj'), { recursive: true })
    await writeFile(join(root, 'ios/App.xcodeproj/project.pbxproj'), 'PRODUCT_BUNDLE_IDENTIFIER = com.example.ios;')

    expect(detectReactNativeBundleIds(root)).toContainEqual({
      bundleId: 'com.example.ios',
      source: join(root, 'ios/App.xcodeproj/project.pbxproj'),
      platform: 'ios',
    })
  })
})
