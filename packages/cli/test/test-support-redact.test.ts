import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../src/support'

describe('[Capgo parity] support secret redaction', () => {
  it('redacts bearer tokens, CodePushGo keys, and private key blocks', () => {
    expect(redactSecrets('Authorization: Bearer abc123DEF456ghi789')).not.toContain('abc123DEF456ghi789')
    expect(redactSecrets('using key capg_1234567890abcdef and capgkey=zzzzzzzzzzzz')).not.toContain('zzzzzzzzzzzz')
    expect(redactSecrets('-----BEGIN PRIVATE KEY-----\nSECRET\n-----END PRIVATE KEY-----')).toBe('[REDACTED PRIVATE KEY]')
  })

  it('redacts JSON-style secrets but keeps non-secret context', () => {
    const out = redactSecrets('{"access_token":"ya29.SECRET","detail":"x","p8Path":"/tmp/AuthKey.p8"}')
    expect(out).not.toContain('ya29.SECRET')
    expect(out).toContain('"detail":"x"')
    expect(out).toContain('/tmp/AuthKey.p8')
  })
})
