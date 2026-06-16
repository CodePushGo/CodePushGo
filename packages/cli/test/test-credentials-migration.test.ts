import { describe, expect, it } from 'vitest'
import { migrateLegacyCredentialEnv } from '../src/credentials'

describe('[Capgo parity] credential migration', () => {
  it('maps legacy Capgo env names to CodePushGo credential fields', () => {
    expect(migrateLegacyCredentialEnv({
      CAPGO_TOKEN: ' legacy-token ',
      CAPGO_ENDPOINT: ' https://legacy.test ',
      CAPGO_APP_ID: ' com.example.legacy ',
      CAPGO_CHANNEL: ' beta ',
    })).toEqual({
      token: 'legacy-token',
      endpoint: 'https://legacy.test',
      appId: 'com.example.legacy',
      channel: 'beta',
    })
  })

  it('ignores empty legacy values', () => {
    expect(migrateLegacyCredentialEnv({ CAPGO_TOKEN: ' ', CAPGO_APP_ID: undefined })).toEqual({})
  })
})
