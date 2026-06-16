import { describe, expect, it } from 'vitest'
import { resizePrompt } from '../src/terminal-layout'

describe('[Capgo parity] CLI shell size gate wiring', () => {
  it('shows resize prompt below the picker floor and no prompt above it', () => {
    expect(resizePrompt(30, 8)).toMatch(/too small/i)
    expect(resizePrompt(60, 20)).toBeUndefined()
  })
})
