import { describe, expect, it } from 'vitest'
import { buildHelpMenuOptions } from '../src/support'

describe('[Capgo parity] support help menu', () => {
  it('keeps support first and includes retry/exit', () => {
    const values = buildHelpMenuOptions({ hasBuildLog: false }).map(option => option.value)
    expect(values[0]).toBe('support')
    expect(values).toContain('retry')
    expect(values).toContain('exit')
    expect(values).not.toContain('ai')
  })

  it('offers AI analysis only when a build log exists', () => {
    expect(buildHelpMenuOptions({ hasBuildLog: true }).map(option => option.value)).toContain('ai')
  })
})
