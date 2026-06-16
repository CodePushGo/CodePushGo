import { describe, expect, it } from 'vitest'
import { AI_RESULT_CHROME_ROWS, computeMaxScrollOffset, estimateRenderedRows, isAiAnalysisTooTall, pickAiPreviewTail, pickVisibleLines, resolveAiResultRoute, stripAnsi } from '../src/ai/fit'

describe('[Capgo parity] AI result fit estimator', () => {
  it('uses a realistic chrome reserve and strips ANSI', () => {
    expect(AI_RESULT_CHROME_ROWS).toBeGreaterThanOrEqual(6)
    expect(AI_RESULT_CHROME_ROWS).toBeLessThanOrEqual(14)
    expect(stripAnsi('\x1B[1;36mhello\x1B[0m world')).toBe('hello world')
  })

  it('counts rows with newlines and wrapping', () => {
    expect(estimateRenderedRows('', 80)).toBe(0)
    expect(estimateRenderedRows('a\nb\n\nc', 80)).toBe(4)
    expect(estimateRenderedRows('a'.repeat(160), 40)).toBe(4)
    expect(estimateRenderedRows('\x1B[31mhello\x1B[0m', 80)).toBe(1)
  })

  it('routes tall analysis to a scroll view and back when it fits', () => {
    const shortText = 'Likely cause\nFix it.'
    const tallText = Array.from({ length: 40 }, (_, index) => `line ${index}`).join('\n')

    expect(isAiAnalysisTooTall(shortText, 40, 80)).toBe(false)
    expect(isAiAnalysisTooTall(tallText, 20, 80)).toBe(true)
    expect(resolveAiResultRoute({ current: 'ai-analysis-result', text: tallText, viewedFull: false, terminalRows: 20, terminalCols: 80 })).toBe('ai-analysis-result-scroll')
    expect(resolveAiResultRoute({ current: 'ai-analysis-result-scroll', text: shortText, viewedFull: false, terminalRows: 60, terminalCols: 120 })).toBe('ai-analysis-result')
    expect(resolveAiResultRoute({ current: 'ai-analysis-result', text: tallText, viewedFull: true, terminalRows: 16, terminalCols: 80 })).toBeNull()
  })

  it('packs visible lines and computes tail offsets with wrapping', () => {
    expect(pickVisibleLines(['a', 'b', 'c'], 1, 2, 80)).toEqual(['b', 'c'])
    expect(pickVisibleLines(['x'.repeat(200)], 0, 5, 20)).toHaveLength(1)
    expect(computeMaxScrollOffset(Array.from({ length: 10 }, (_, index) => `line ${index}`), 3, 80)).toBe(7)

    const preview = pickAiPreviewTail(Array.from({ length: 30 }, (_, index) => `line ${index}`).join('\n'), 20, 80)
    expect(preview.hidden).toBe(18)
    expect(preview.rows.at(-1)).toBe('line 29')
  })
})
