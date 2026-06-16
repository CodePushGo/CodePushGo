import { describe, expect, it } from 'vitest'
import { isBuildCompleteDismissKey } from '../src/terminal-layout'

describe('[Capgo parity] build complete exit gate', () => {
  it('dismisses only on explicit completion keys', () => {
    expect(isBuildCompleteDismissKey('', { return: true })).toBe(true)
    expect(isBuildCompleteDismissKey('', { escape: true })).toBe(true)
    expect(isBuildCompleteDismissKey('q', {})).toBe(true)
    expect(isBuildCompleteDismissKey('x', {})).toBe(false)
    expect(isBuildCompleteDismissKey(' ', {})).toBe(false)
    expect(isBuildCompleteDismissKey('', {})).toBe(false)
  })
})
