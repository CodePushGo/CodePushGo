import { describe, expect, it, vi } from 'vitest'
import { postAnalyzeStreamRequest } from '../src/ai/analyze'

const baseInput = { apiHost: 'https://api.test', apikey: 'k', jobId: 'j1', appId: 'a1', logs: 'log text' }

function sseResponse(frames: string[], status = 200) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const frame of frames)
        controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } })
}

describe('[Capgo parity] AI analyze stream request', () => {
  it('posts the RN app id/logs and accumulates streamed chunks', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      'event: chunk\ndata: {"text":"Hello "}\n\n',
      'event: chunk\ndata: {"text":"world"}\n\n',
      'event: done\ndata: {"durationMs":42}\n\n',
    ]))
    const chunks: string[] = []

    const result = await postAnalyzeStreamRequest({ ...baseInput, onChunk: chunk => chunks.push(chunk) })

    expect(result).toEqual({ kind: 'ok', analysis: 'Hello world' })
    expect(chunks).toEqual(['Hello ', 'world'])
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/build/ai_analyze_stream', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
    expect(body).toMatchObject({ jobId: 'j1', appId: 'a1', logs: 'log text' })
    fetchMock.mockRestore()
  })

  it('maps terminal and stream error cases', async () => {
    let fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 413 }))
    await expect(postAnalyzeStreamRequest(baseInput)).resolves.toEqual({ kind: 'too_big' })
    fetchMock.mockRestore()

    fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Please upgrade' }), { status: 426 }))
    await expect(postAnalyzeStreamRequest(baseInput)).resolves.toEqual({ kind: 'upgrade_required', message: 'Please upgrade' })
    fetchMock.mockRestore()

    fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      'event: chunk\ndata: {"text":"partial"}\n\n',
      'event: error\ndata: {"code":"idle_timeout"}\n\n',
    ]))
    await expect(postAnalyzeStreamRequest(baseInput)).resolves.toEqual({ kind: 'error', message: 'idle_timeout', partial: 'partial' })
    fetchMock.mockRestore()
  })
})
