import { describe, expect, it } from 'vitest'
import { parsePbxprojBundleIds } from '../src/react-native-config'

describe('[Capgo parity] pbxproj bundle id parser', () => {
  it('prefers release bundle ids and ignores unresolved Xcode placeholders', () => {
    const content = `
      /* Debug */ = { isa = XCBuildConfiguration; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.app.dev; }; name = Debug; };
      /* Release */ = { isa = XCBuildConfiguration; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.app; }; name = Release; };
      /* Other */ = { isa = XCBuildConfiguration; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = $(PRODUCT_BUNDLE_IDENTIFIER); }; name = Other; };
    `
    expect(parsePbxprojBundleIds(content)).toEqual(['com.example.app', 'com.example.app.dev'])
  })
})
