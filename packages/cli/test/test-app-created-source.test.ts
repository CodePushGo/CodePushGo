import { describe, expect, it } from 'vitest'
import { getInvocationSource, resolveAppCreateSource, setInvocationSource } from '../src/analytics/track'

describe('[Capgo parity] app creation source resolution', () => {
  it('uses explicit onboarding source when provided', () => {
    expect(resolveAppCreateSource('onboarding')).toBe('onboarding')
  })

  it('defaults app creation source to direct CLI invocation', () => {
    setInvocationSource('cli')

    expect(resolveAppCreateSource()).toBe('cli-direct')
    expect(getInvocationSource()).toBe('cli')
  })

  it('maps MCP invocation context to mcp app creation source', () => {
    try {
      setInvocationSource('mcp')

      expect(resolveAppCreateSource()).toBe('mcp')
      expect(getInvocationSource()).toBe('mcp')
    }
    finally {
      setInvocationSource('cli')
    }
  })
})
