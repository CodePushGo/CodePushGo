import { describe, expect, it } from 'vitest'
import { sha256 } from '../src/archive'

describe('[Capgo parity] checksum algorithm selection', () => {
  it('uses SHA256 checksums for React Native bundle uploads', () => {
    const bytes = new TextEncoder().encode('react-native-bundle')
    expect(sha256(bytes)).toBe('ac65cd3bfc695e727e637567776cca4febc456772cb61309a65677e63c72b2e0')
    expect(sha256(bytes)).toHaveLength(64)
  })
})
