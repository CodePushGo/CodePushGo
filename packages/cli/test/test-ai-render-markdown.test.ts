import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/ai/render-markdown'

const ESC = '\x1B'

describe('[Capgo parity] AI markdown renderer', () => {
  it('returns raw markdown outside TTY mode', () => {
    const markdown = '### Likely cause\nfoo\n\n```\nx\n```'
    expect(renderMarkdown(markdown, false)).toBe(markdown)
  })

  it('styles headers, lists, inline code, bold text, and fenced code', () => {
    const output = renderMarkdown([
      '### Likely cause',
      'Use `bundleId` and **connect** automatically.',
      '```',
      'error: missing bundle',
      '',
      '```',
      '1. Fix config',
      '- retry',
    ].join('\n'), true)

    expect(output).toContain(`${ESC}[1m${ESC}[32mLikely cause${ESC}[0m`)
    expect(output).toContain(`${ESC}[36m${ESC}[2mbundleId${ESC}[0m`)
    expect(output).toContain(`${ESC}[1mconnect${ESC}[0m`)
    expect(output).toContain(`${ESC}[90m| ${ESC}[0merror: missing bundle`)
    expect(output).toContain(`${ESC}[33m1.${ESC}[0m Fix config`)
    expect(output).toContain(`${ESC}[33m*${ESC}[0m retry`)
    expect(output).not.toContain('```')
  })
})
