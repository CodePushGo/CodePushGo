import { describe, expect, it } from 'vitest'
import { pickAiPreviewTail, resolveAiResultRoute } from '../src/ai/fit'

describe('[Capgo parity] AI frame fit on resize', () => {
  it('moves between inline and scroll without oscillating', () => {
    const shortText = 'Likely cause\nMissing bundle id.'
    const tallText = Array.from({ length: 40 }, (_, index) => `line ${index}`).join('\n')

    for (const text of [shortText, tallText]) {
      for (const rows of [12, 16, 20, 30, 50]) {
        for (const start of ['ai-analysis-result', 'ai-analysis-result-scroll'] as const) {
          const next = resolveAiResultRoute({ current: start, text, viewedFull: false, terminalRows: rows, terminalCols: 80 })
          const settled = next ?? start
          expect(resolveAiResultRoute({ current: settled, text, viewedFull: false, terminalRows: rows, terminalCols: 80 })).toBeNull()
        }
      }
    }
  })

  it('keeps streaming preview anchored to the latest rows', () => {
    const preview = pickAiPreviewTail(Array.from({ length: 30 }, (_, index) => `line ${index}`).join('\n'), 20, 80)
    expect(preview.hidden).toBeGreaterThan(0)
    expect(preview.rows[0]).toBe('line 18')
    expect(preview.rows.at(-1)).toBe('line 29')
  })
})
