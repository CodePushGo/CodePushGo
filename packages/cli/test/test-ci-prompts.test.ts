import { describe, expect, it } from 'vitest'
import { canPromptInteractively } from '../src/utils'

describe('[Capgo parity] CI prompt guard', () => {
  it('disables prompts in CI even when streams look interactive', () => {
    expect(canPromptInteractively({ stdinIsTTY: true, stdoutIsTTY: true, ci: true })).toBe(false)
  })

  it('disables prompts when either stream is not interactive', () => {
    expect(canPromptInteractively({ stdinIsTTY: false, stdoutIsTTY: true, ci: false })).toBe(false)
    expect(canPromptInteractively({ stdinIsTTY: true, stdoutIsTTY: false, ci: false })).toBe(false)
  })

  it('disables prompts in silent mode and allows local interactive sessions', () => {
    expect(canPromptInteractively({ silent: true, stdinIsTTY: true, stdoutIsTTY: true, ci: false })).toBe(false)
    expect(canPromptInteractively({ stdinIsTTY: true, stdoutIsTTY: true, ci: false })).toBe(true)
  })
})
