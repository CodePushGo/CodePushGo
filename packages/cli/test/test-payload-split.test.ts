import { describe, expect, it } from 'vitest'
import { splitUploadPayload } from '../src/payload'

describe('[Capgo parity] React Native upload payload split', () => {
  it('keeps secrets in credentials and non-secrets in upload options', () => {
    expect(splitUploadPayload({
      CODEPUSHGO_TOKEN: 'token',
      CODEPUSHGO_PRIVATE_KEY: 'private',
      CODEPUSHGO_APP_ID: 'com.example.app',
      CODEPUSHGO_CHANNEL: 'production',
      BUILD_OUTPUT_UPLOAD_ENABLED: 'true',
    }, 'ios', '0.1.0')).toEqual({
      uploadOptions: {
        platform: 'ios',
        cliVersion: '0.1.0',
        CODEPUSHGO_APP_ID: 'com.example.app',
        CODEPUSHGO_CHANNEL: 'production',
        BUILD_OUTPUT_UPLOAD_ENABLED: 'true',
      },
      credentials: {
        CODEPUSHGO_TOKEN: 'token',
        CODEPUSHGO_PRIVATE_KEY: 'private',
      },
    })
  })
})
