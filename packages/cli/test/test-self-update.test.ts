import { describe, expect, it } from 'vitest'
import { formatUpdatePrompt, shouldShowUpdatePrompt } from '../src/update-prompt'

describe('[Capgo parity] self update prompt', () => {
  it('prompts only when a newer CLI version is known', () => {
    expect(shouldShowUpdatePrompt({ currentVersion: '0.1.0', latestVersion: '0.1.1' })).toBe(true)
    expect(shouldShowUpdatePrompt({ currentVersion: '0.1.0', latestVersion: '0.1.0' })).toBe(false)
    expect(formatUpdatePrompt({ currentVersion: '0.1.0', latestVersion: '0.1.1' })).toContain('@codepushgo/cli')
  })
})
