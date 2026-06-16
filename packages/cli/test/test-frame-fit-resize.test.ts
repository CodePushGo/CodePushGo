import { describe, expect, it } from 'vitest'
import { pickPlatformLayout, resizePrompt } from '../src/terminal-layout'

describe('[Capgo parity] terminal resize reactions', () => {
  it('layout follows terminal size changes', () => {
    expect(pickPlatformLayout(80, 24)).toBe('cards')
    expect(pickPlatformLayout(40, 24)).toBe('list')
    expect(resizePrompt(30, 8)).toBeDefined()
    expect(resizePrompt(80, 24)).toBeUndefined()
  })
})
