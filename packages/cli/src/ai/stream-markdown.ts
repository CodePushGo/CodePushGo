import { renderMarkdown } from './render-markdown'

export interface StreamingMarkdownRenderer {
  feed(chunk: string): void
  flush(): void
}

export function createStreamingMarkdownRenderer(write: (text: string) => void, isTTY: boolean): StreamingMarkdownRenderer {
  if (!isTTY)
    return createRawStreamingRenderer(write)

  let completeSource = ''
  let pending = ''
  let emitted = ''
  let pausedForFence = false

  function emitRenderedDelta() {
    const rendered = renderMarkdown(completeSource, true)
    if (!rendered.startsWith(emitted))
      return
    const delta = rendered.slice(emitted.length)
    if (delta)
      write(delta)
    emitted = rendered
  }

  return {
    feed(chunk: string) {
      pending += chunk
      const lastNewline = pending.lastIndexOf('\n')
      if (lastNewline === -1)
        return

      const ready = pending.slice(0, lastNewline + 1)
      pending = pending.slice(lastNewline + 1)
      completeSource += ready

      if (ready.split('\n').some(line => line.trim().startsWith('```')))
        pausedForFence = true
      if (!pausedForFence)
        emitRenderedDelta()
    },
    flush() {
      if (pending !== '') {
        completeSource += pending
        pending = ''
      }
      pausedForFence = false
      emitRenderedDelta()
    },
  }
}

function createRawStreamingRenderer(write: (text: string) => void): StreamingMarkdownRenderer {
  return {
    feed(chunk: string) {
      write(chunk)
    },
    flush() {},
  }
}
