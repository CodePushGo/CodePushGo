import { describe, expect, it } from 'vitest'
import { MIN_TERMINAL_COLS, MIN_TERMINAL_ROWS, resizePrompt, terminalMeetsMinimum } from '../src/terminal-layout'

describe('[Capgo parity] terminal min-size gate', () => {
  it('accepts exact and ample terminal sizes', () => {
    expect(terminalMeetsMinimum(MIN_TERMINAL_COLS, MIN_TERMINAL_ROWS)).toBe(true)
    expect(terminalMeetsMinimum(MIN_TERMINAL_COLS + 20, MIN_TERMINAL_ROWS + 10)).toBe(true)
  })

  it('returns useful resize prompts for small terminals', () => {
    expect(terminalMeetsMinimum(MIN_TERMINAL_COLS - 1, MIN_TERMINAL_ROWS)).toBe(false)
    expect(resizePrompt(MIN_TERMINAL_COLS - 1, MIN_TERMINAL_ROWS)).toContain('Widen')
    expect(resizePrompt(MIN_TERMINAL_COLS, MIN_TERMINAL_ROWS - 1)).toContain('Make taller')
  })
})
