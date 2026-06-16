import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { detectReactNativeBundleId, parsePbxprojBundleIds } from '../src/react-native-config'

async function tempProject(name: string) {
  const root = join(tmpdir(), `codepushgo-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

describe('[Capgo parity] React Native bundle id detector', () => {
  it('returns Release bundle id before Debug ids', () => {
    const ids = parsePbxprojBundleIds(`
      1D2E3F /* Debug */ = {
        isa = XCBuildConfiguration;
        buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.app.debug; };
        name = Debug;
      };
      1A2B3C /* Release */ = {
        isa = XCBuildConfiguration;
        buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.app; };
        name = Release;
      };
    `)

    expect(ids[0]).toBe('com.example.app')
  })

  it('chooses the parent Release id before extension ids', () => {
    const ids = parsePbxprojBundleIds(`
      1A2B3C /* Release */ = {
        isa = XCBuildConfiguration;
        buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.app.notification; };
        name = Release;
      };
      1D2E3F /* Release */ = {
        isa = XCBuildConfiguration;
        buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.app; };
        name = Release;
      };
    `)

    expect(ids[0]).toBe('com.example.app')
  })

  it('skips Xcode variable placeholders', () => {
    expect(parsePbxprojBundleIds(`
      PRODUCT_BUNDLE_IDENTIFIER = "$(PRODUCT_BUNDLE_IDENTIFIER:rfc1034identifier)";
      PRODUCT_BUNDLE_IDENTIFIER = com.example.real;
    `)).toEqual(['com.example.real'])
  })

  it('detects the authoritative id from a React Native iOS project', async () => {
    const root = await tempProject('rn-ios-bundle-id')
    await mkdir(join(root, 'ios/App.xcodeproj'), { recursive: true })
    await writeFile(join(root, 'ios/App.xcodeproj/project.pbxproj'), `
      1D2E3F /* Debug */ = {
        isa = XCBuildConfiguration;
        buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.debug; };
        name = Debug;
      };
      1A2B3C /* Release */ = {
        isa = XCBuildConfiguration;
        buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.release; };
        name = Release;
      };
    `)

    expect(detectReactNativeBundleId(root, 'ios')).toMatchObject({ bundleId: 'com.example.release', platform: 'ios' })
  })
})
