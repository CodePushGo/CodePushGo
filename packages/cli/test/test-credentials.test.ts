import { describe, expect, it } from 'vitest'
import { loadCredentialsFromEnv, mergeCredentials } from '../src/credentials'

describe('[Capgo parity] React Native CLI credentials', () => {
  it('loads CodePushGo credentials from environment variables', () => {
    expect(loadCredentialsFromEnv({
      CODEPUSHGO_TOKEN: ' token ',
      CODEPUSHGO_ENDPOINT: ' https://api.test ',
      CODEPUSHGO_APP_ID: ' com.example.app ',
      CODEPUSHGO_CHANNEL: ' production ',
    })).toEqual({
      token: 'token',
      endpoint: 'https://api.test',
      appId: 'com.example.app',
      channel: 'production',
    })
  })

  it('merges credentials with CLI > env > config precedence', () => {
    expect(mergeCredentials(
      { token: 'config-token', endpoint: 'config-endpoint', appId: 'com.config.app', channel: 'config' },
      { token: 'env-token', appId: 'com.env.app' },
      { appId: 'com.cli.app' },
    )).toEqual({
      token: 'env-token',
      endpoint: 'config-endpoint',
      appId: 'com.cli.app',
      channel: 'config',
      platform: undefined,
    })
  })
})
