import { describe, expect, it } from 'vitest'
import { decideAnalyzeBehavior } from '../src/ai/analyze'

describe('[Capgo parity] AI onboarding mode', () => {
  it('preserves the caller-handled mode matrix', () => {
    expect(decideAnalyzeBehavior({ isTTY: true, aiAnalyticsFlag: true })).toBe('show_menu')
    expect(decideAnalyzeBehavior({ isTTY: true, aiAnalyticsFlag: false })).toBe('ask_then_menu')
    expect(decideAnalyzeBehavior({ isTTY: false, aiAnalyticsFlag: true })).toBe('auto_upload')
    expect(decideAnalyzeBehavior({ isTTY: false, aiAnalyticsFlag: false })).toBe('skip')
  })
})
