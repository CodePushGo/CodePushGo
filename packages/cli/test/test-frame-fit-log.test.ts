import { describe, expect, it } from 'vitest'
import { capLogRows, logBudgetRows } from '../src/terminal-layout'

describe('[Capgo parity] completed steps log fit', () => {
  it('log budget plus header/body chrome never exceeds the terminal', () => {
    for (const rows of [12, 16, 19, 24, 40]) {
      for (const headerRows of [1, 5]) {
        for (const bodyRows of [0, 1, 6, 11, 20]) {
          const budget = logBudgetRows(rows, headerRows, bodyRows)
          expect(budget).toBeGreaterThanOrEqual(0)
          if (budget > 0)
            expect(headerRows + 2 + bodyRows + 1 + budget).toBeLessThanOrEqual(rows)
        }
      }
    }
  })

  it('caps long completed-step logs and reports hidden rows', () => {
    const entries = Array.from({ length: 30 }, (_, index) => ({ text: `step ${index + 1}` }))
    expect(capLogRows(entries, 0)).toEqual({ visible: [], hidden: 30 })
    expect(capLogRows(entries, 1)).toEqual({ visible: [], hidden: 30 })
    const capped = capLogRows(entries, 4)
    expect(capped.hidden).toBe(27)
    expect(capped.visible.map(entry => entry.text)).toEqual(['step 28', 'step 29', 'step 30'])
  })
})
