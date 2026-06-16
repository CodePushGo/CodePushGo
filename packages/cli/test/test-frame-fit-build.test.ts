import { describe, expect, it } from 'vitest'
import { buildOutputViewport } from '../src/viewport'
import { buildScrollAction, formatElapsed } from '../src/terminal-layout'

describe('[Capgo parity] fullscreen build output fit', () => {
  const longLog = Array.from({ length: 400 }, (_, index) => `build log line ${index + 1}`)

  it('tails long build output without exceeding terminal rows', () => {
    for (const rows of [10, 16, 24, 33, 40, 60]) {
      const frame = buildOutputViewport(longLog, rows, 80)
      expect(frame.length).toBeLessThanOrEqual(rows)
      expect(frame.at(-1)).toBe('build log line 400')
      expect(frame.join('\n')).not.toContain('build log line 10')
    }
  })

  it('handles scroll/follow transitions and elapsed labels', () => {
    const state = { scrollOffset: 20, maxScrollOffset: 20, viewportRows: 10 }
    expect(buildScrollAction('', { upArrow: true }, state)).toEqual({ scrollOffset: 19, follow: false })
    expect(buildScrollAction('', { downArrow: true }, { ...state, scrollOffset: 19 })).toEqual({ scrollOffset: 20, follow: true })
    expect(buildScrollAction('g', {}, state)).toEqual({ scrollOffset: 0, follow: false })
    expect(buildScrollAction('G', {}, { ...state, scrollOffset: 0 })).toEqual({ scrollOffset: 20, follow: true })
    expect(buildScrollAction('x', {}, state)).toBeNull()
    expect(formatElapsed(-500)).toBe('0s')
    expect(formatElapsed(83_000)).toBe('1m 23s')
  })
})
