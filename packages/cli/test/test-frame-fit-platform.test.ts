import { describe, expect, it } from 'vitest'
import { pickPlatformLayout } from '../src/terminal-layout'

describe('[Capgo parity] platform frame fit', () => {
  it('keeps platform picker in compact list mode for narrow or short terminals', () => {
    expect(pickPlatformLayout(40, 24)).toBe('list')
    expect(pickPlatformLayout(80, 12)).toBe('list')
  })
})
