import { describe, expect, it } from 'vitest'
import { formatUpdatePrompt, shouldShowUpdatePrompt } from '../src/update-prompt'

describe('[Capgo parity] CLI update prompt decision', () => {
  it('shows prompt only when latest version differs', () => {
    expect(shouldShowUpdatePrompt({ currentVersion: '0.1.0', latestVersion: '0.1.1' })).toBe(true)
    expect(shouldShowUpdatePrompt({ currentVersion: '0.1.0', latestVersion: '0.1.0' })).toBe(false)
    expect(shouldShowUpdatePrompt(undefined)).toBe(false)
  })

  it('formats current and latest versions', () => {
    expect(formatUpdatePrompt({ currentVersion: '0.1.0', latestVersion: '0.1.1' })).toContain('0.1.0 -> 0.1.1')
  })
})
