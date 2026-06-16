import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/ai/render-markdown'
import { createStreamingMarkdownRenderer } from '../src/ai/stream-markdown'

function streamRender(chunks: string[], isTTY = true) {
  let output = ''
  const renderer = createStreamingMarkdownRenderer(text => { output += text }, isTTY)
  for (const chunk of chunks)
    renderer.feed(chunk)
  renderer.flush()
  return output
}

describe('[Capgo parity] AI streaming markdown renderer', () => {
  const samples = [
    '### Likely cause\nThe build failed because `bundleId` is **missing**.\n\n```\nerror: cannot find bundle\n```\n\n1. Edit config\n- retry\n',
    '### Header\nplain tail without newline',
    '```\nunclosed fence tail',
    '',
    'plain only',
  ]

  it('matches buffered rendering for every two-chunk split', () => {
    for (const markdown of samples) {
      const expected = renderMarkdown(markdown, true)
      for (let split = 0; split <= markdown.length; split += 1)
        expect(streamRender([markdown.slice(0, split), markdown.slice(split)])).toBe(expected)
    }
  })

  it('passes through raw markdown outside TTY mode', () => {
    const markdown = '### Header\n`code` and **bold**\n'
    expect(streamRender([markdown.slice(0, 7), markdown.slice(7)], false)).toBe(markdown)
  })

  it('emits complete lines progressively', () => {
    const writes: string[] = []
    const renderer = createStreamingMarkdownRenderer(text => writes.push(text), true)
    renderer.feed('### Head')
    expect(writes).toHaveLength(0)
    renderer.feed('er\nbody')
    expect(writes.join('')).toContain('Header')
  })
})
