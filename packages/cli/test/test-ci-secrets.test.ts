import { describe, expect, it } from 'vitest'
import { createCiSecretEntries, redactSecretValue } from '../src/ci-secrets'

describe('[Capgo parity] CI secret helpers', () => {
  it('creates masked CodePushGo token and upload config entries', () => {
    expect(createCiSecretEntries({
      CODEPUSHGO_APP_ID: ' com.example.app ',
      CODEPUSHGO_ENDPOINT: 'https://api.example.test',
      CODEPUSHGO_CHANNEL: 'production',
      CODEPUSHGO_PRIVATE_KEY: 'private-key',
      EMPTY: '',
    }, '  test-token  ')).toEqual([
      { key: 'CODEPUSHGO_TOKEN', value: 'test-token', masked: true },
      { key: 'CODEPUSHGO_ENDPOINT', value: 'https://api.example.test', masked: true },
      { key: 'CODEPUSHGO_APP_ID', value: 'com.example.app', masked: true },
      { key: 'CODEPUSHGO_CHANNEL', value: 'production', masked: false },
      { key: 'CODEPUSHGO_PRIVATE_KEY', value: 'private-key', masked: true },
    ])
  })

  it('omits empty token and secret values', () => {
    expect(createCiSecretEntries({ CODEPUSHGO_APP_ID: '   ' }, '  ')).toEqual([])
  })

  it('redacts secrets for logs without changing stored values', () => {
    expect(redactSecretValue('abcdef')).toBe('******')
    expect(redactSecretValue('cap_test_secret_value')).toBe('cap************lue')
  })
})
