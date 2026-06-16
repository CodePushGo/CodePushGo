import { describe, expect, it } from 'vitest'
import { diffViewport, type DiffLine } from '../src/viewport'

describe('[Capgo parity] diff viewer viewport', () => {
  it('uses the real terminal budget and truncates giant diff lines', () => {
    const lines: DiffLine[] = Array.from({ length: 60 }, (_, index) => ({ kind: 'add', text: `line ${index + 1}: workflow yaml content` }))
    lines.splice(5, 0, { kind: 'add', text: `KEY: ${'A'.repeat(900)}` })

    const rows = diffViewport(lines, 40, 100)

    expect(rows.length).toBe(33)
    expect(rows.some(row => row.includes('Summary:'))).toBe(false)
    const giant = rows.find(row => row.includes('KEY:'))
    expect(giant).toBeDefined()
    expect(giant?.length).toBe(100)
    expect(rows).not.toContain(expect.stringMatching(/^A{40,}$/))
  })
})
