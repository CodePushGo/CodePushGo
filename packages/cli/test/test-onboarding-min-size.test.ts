import { describe, expect, it } from 'vitest'
import { MIN_TERMINAL_COLS, MIN_TERMINAL_ROWS, terminalMeetsMinimum } from '../src/terminal-layout'

describe('[Capgo parity] onboarding min-size constants', () => {
  it('keeps the RN CLI picker floor explicit', () => {
    expect(MIN_TERMINAL_COLS).toBe(44)
    expect(MIN_TERMINAL_ROWS).toBe(11)
    expect(terminalMeetsMinimum(44, 11)).toBe(true)
    expect(terminalMeetsMinimum(43, 11)).toBe(false)
  })
})
