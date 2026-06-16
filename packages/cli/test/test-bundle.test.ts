import { describe, expect, it } from 'vitest'
import { reactNativeBundleArgs } from '../src/react-native'

describe('[Capgo parity] React Native CLI bundle command', () => {
  it('builds Metro bundle args with stable output paths', () => {
    expect(reactNativeBundleArgs({
      platform: 'android',
      entryFile: 'index.js',
      outDir: 'dist/codepushgo/android',
      dev: false,
      sourcemap: true,
    })).toEqual([
      'react-native',
      'bundle',
      '--platform', 'android',
      '--entry-file', 'index.js',
      '--bundle-output', 'dist/codepushgo/android/index.android.bundle',
      '--assets-dest', 'dist/codepushgo/android/assets',
      '--dev', 'false',
      '--sourcemap-output', 'dist/codepushgo/android/index.android.bundle.map',
    ])
  })

  it('omits sourcemap output unless requested', () => {
    expect(reactNativeBundleArgs({
      platform: 'ios',
      entryFile: 'src/App.tsx',
      outDir: 'build/ios',
      dev: true,
    })).toEqual([
      'react-native',
      'bundle',
      '--platform', 'ios',
      '--entry-file', 'src/App.tsx',
      '--bundle-output', 'build/ios/index.ios.bundle',
      '--assets-dest', 'build/ios/assets',
      '--dev', 'true',
    ])
  })
})
