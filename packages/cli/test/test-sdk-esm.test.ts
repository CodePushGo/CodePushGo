import { describe, expect, it } from 'vitest'

describe('[Capgo parity] React Native updater ESM exports', () => {
  it('exports the updater client as ESM', async () => {
    const sdk = await import('../../react-native-updater/src/index')
    expect(typeof sdk.CodePushGoClient).toBe('function')
    expect(typeof sdk.createCodePushGoClient).toBe('function')
    expect(typeof sdk.startCodePushGo).toBe('function')
  })
})
