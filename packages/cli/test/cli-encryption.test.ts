import { describe, expect, it } from 'vitest'
import { CodePushGoApi } from '../src/api'
import { sha256 } from '../src/archive'
import { calcKeyId, createRSAKeys, decryptChecksum, decryptSource, encryptBundle } from '../src/crypto'

describe('[Capgo parity] CLI bundle encryption', () => {
  it('encrypts bundle bytes and checksum with a decryptable Capgo-style session key', () => {
    const keys = createRSAKeys()
    const bytes = new TextEncoder().encode('react-native-bundle')
    const checksum = sha256(bytes)

    const encrypted = encryptBundle(bytes, checksum, keys.privateKey, keys.publicKey)

    expect(encrypted.bytes).not.toEqual(bytes)
    expect(encrypted.sessionKey).toContain(':')
    expect(encrypted.keyId).toBe(calcKeyId(keys.publicKey))
    expect(decryptChecksum(encrypted.checksum, keys.publicKey)).toBe(checksum)
    expect(new TextDecoder().decode(decryptSource(encrypted.bytes, encrypted.sessionKey, keys.publicKey))).toBe('react-native-bundle')
  })

  it('sends encrypted bundle metadata as upload headers', async () => {
    const requests: Array<{ url: string, headers: Headers, body?: ArrayBuffer }> = []
    const api = new CodePushGoApi({
      endpoint: 'https://api.test',
      token: 'test-token',
      fetch: (async (input, init) => {
        requests.push({
          url: String(input),
          headers: new Headers(init?.headers),
          body: init?.body instanceof Blob ? await init.body.arrayBuffer() : undefined,
        })
        return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'content-type': 'application/json' } })
      }) as typeof fetch,
    })

    const bytes = new Uint8Array([1, 2, 3])
    await api.uploadBundle({
      appId: 'com.example.app',
      version: '1.2.3',
      platform: 'ios',
      channel: 'production',
      bytes,
      checksum: 'encrypted-checksum',
      sessionKey: 'iv:session',
      keyId: 'MIIBCgKCAQEAtest12',
    })

    expect(requests).toHaveLength(1)
    expect(requests[0]!.url).toBe('https://api.test/v1/apps/com.example.app/bundles')
    expect(requests[0]!.headers.get('x-codepushgo-checksum')).toBe('encrypted-checksum')
    expect(requests[0]!.headers.get('x-codepushgo-session-key')).toBe('iv:session')
    expect(requests[0]!.headers.get('x-codepushgo-key-id')).toBe('MIIBCgKCAQEAtest12')
    expect(new Uint8Array(requests[0]!.body!)).toEqual(bytes)
  })
})
