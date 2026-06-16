import { describe, expect, it } from 'vitest'
import { computeMaxScrollOffset, pickVisibleLines } from '../src/ai/fit'

describe('[Capgo parity] fullscreen AI viewer fit', () => {
  it('uses a near-full viewport instead of wasting terminal rows', () => {
    const lines = Array.from({ length: 20 }, (_, index) => `analysis line ${index + 1}`)
    const visible = pickVisibleLines(lines, 0, 18, 100)
    expect(visible.length).toBeGreaterThanOrEqual(18)
    expect(visible[0]).toBe('analysis line 1')
  })

  it('accounts for wrapping and blank lines while computing max scroll', () => {
    const lines = ['Likely cause', 'X'.repeat(120), '', 'Evidence', 'final A', 'final B']
    expect(computeMaxScrollOffset(lines, 8, 80)).toBe(0)
    expect(computeMaxScrollOffset([...lines, ...Array.from({ length: 20 }, (_, index) => `extra ${index}`)], 8, 80)).toBeGreaterThan(0)
  })
})
