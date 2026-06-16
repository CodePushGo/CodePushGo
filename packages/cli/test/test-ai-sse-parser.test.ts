import { describe, expect, it } from 'vitest'
import { createSseParser } from '../src/ai/sse'

describe('[Capgo parity] AI SSE parser', () => {
  it('parses complete and split frames', () => {
    const events: Array<{ event: string, data: string }> = []
    const feed = createSseParser(event => events.push(event))

    feed('event: chunk\ndata: {"text":"hi"}\n\n')
    feed('event: chu')
    feed('nk\ndata: line1\ndata: line2\n\n')
    feed(': keep-alive\n\nevent: done\ndata: {"durationMs":1}\n\n')

    expect(events).toEqual([
      { event: 'chunk', data: '{"text":"hi"}' },
      { event: 'chunk', data: 'line1\nline2' },
      { event: 'done', data: '{"durationMs":1}' },
    ])
  })

  it('handles CRLF frames split across feeds', () => {
    const events: Array<{ event: string, data: string }> = []
    const feed = createSseParser(event => events.push(event))

    feed('event: chunk\r\ndata: {"text":"x"}\r')
    feed('\n\r\nevent: done\r\ndata: {}\r\n\r\n')

    expect(events).toEqual([
      { event: 'chunk', data: '{"text":"x"}' },
      { event: 'done', data: '{}' },
    ])
  })
})
