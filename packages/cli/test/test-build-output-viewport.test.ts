import { describe, expect, it } from 'vitest'
import { buildOutputViewport, sanitizedBuildOutputViewport } from '../src/viewport'

describe('[Capgo parity] build output viewport', () => {
  it('truncates giant build lines to one terminal row', () => {
    const tail = 'adding: bundle/index.bundle (deflated 52%)'
    const rows = buildOutputViewport([
      'Requesting build for app...',
      `CODEPUSHGO_SECRET=${'A'.repeat(900)}`,
      tail,
    ], 20, 80)

    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveLength(80)
    expect(rows[1]).toContain('CODEPUSHGO_SECRET=')
    expect(rows[1]).not.toMatch(/^A{40,}$/)
    expect(rows).toContain(tail)
  })

  it('sanitizes tabs and control bytes before viewport truncation', () => {
    const rows = sanitizedBuildOutputViewport('Modified Targets:\n\t* App\n\t* Release\nStep: done\x07', 20, 80)
    expect(rows).toContain('        * App')
    expect(rows).toContain('        * Release')
    expect(rows.join('\n')).not.toContain('\t')
    expect(rows.join('\n')).not.toContain('\x07')
  })
})
