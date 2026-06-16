import { describe, expect, it } from 'vitest'
import { validateCliCredentials } from '../src/credentials'

describe('[Capgo parity] credential validation', () => {
  it('requires token and React Native bundle app id', () => {
    expect(validateCliCredentials({})).toEqual(['CODEPUSHGO_TOKEN', 'CODEPUSHGO_APP_ID'])
    expect(validateCliCredentials({ token: 'token', appId: 'invalid' })).toEqual(['CODEPUSHGO_APP_ID must be a reverse-domain React Native bundle id'])
    expect(validateCliCredentials({ token: 'token', appId: 'com.example.app' })).toEqual([])
  })
})
