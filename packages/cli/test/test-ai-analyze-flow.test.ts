import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { decideAnalyzeBehavior, HARD_LOG_SIZE_LIMIT, releaseCapturedLogs, runCapgoAiAnalysis, writeLocalAiFile } from '../src/ai/analyze'

const testDir = join(tmpdir(), `codepushgo-ai-flow-test-${Date.now()}`)

function sseResponse(frames: string[]) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const frame of frames)
        controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

describe('[Capgo parity] AI analyze flow', () => {
  beforeAll(async () => {
    process.env.CODEPUSHGO_AI_LOG_BASE_DIR = testDir
    await mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    delete process.env.CODEPUSHGO_AI_LOG_BASE_DIR
    await rm(testDir, { recursive: true, force: true })
  })

  it('keeps the interactive/non-interactive behavior matrix', () => {
    expect(decideAnalyzeBehavior({ isTTY: true, aiAnalyticsFlag: true })).toBe('show_menu')
    expect(decideAnalyzeBehavior({ isTTY: true, aiAnalyticsFlag: false })).toBe('ask_then_menu')
    expect(decideAnalyzeBehavior({ isTTY: false, aiAnalyticsFlag: true })).toBe('auto_upload')
    expect(decideAnalyzeBehavior({ isTTY: false, aiAnalyticsFlag: false })).toBe('skip')
  })

  it('writes a local AI prompt file with log boundaries', async () => {
    const jobId = 'job-flow-local'
    await writeFile(join(testDir, `${jobId}.log`), 'line1\nline2\n')
    const promptPath = await writeLocalAiFile(jobId)
    const prompt = readFileSync(promptPath, 'utf8')
    expect(prompt).toContain('React Native')
    expect(prompt).toContain('<BUILD_LOG>')
    expect(prompt).toContain('line1\nline2')
  })

  it('reads captured logs and posts them to the streaming analyzer', async () => {
    const jobId = 'job-flow-stream'
    await writeFile(join(testDir, `${jobId}.log`), 'pretend metro log line\n')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      'event: chunk\ndata: {"text":"### Likely cause\\nbundle"}\n\n',
      'event: done\ndata: {}\n\n',
    ]))

    const result = await runCapgoAiAnalysis({ apiHost: 'https://api.test', apikey: 'key', jobId, appId: 'com.test.app' })

    expect(result.kind).toBe('ok')
    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.logs).toContain('pretend metro')
    fetchMock.mockRestore()
  })

  it('does not upload missing or oversized captured logs and releases files', async () => {
    const missing = await runCapgoAiAnalysis({ apiHost: 'https://api.test', apikey: 'key', jobId: 'missing', appId: 'com.test.app' })
    expect(missing.kind).toBe('error')

    const bigJobId = 'job-big'
    await writeFile(join(testDir, `${bigJobId}.log`), Buffer.alloc(HARD_LOG_SIZE_LIMIT + 1, 'x'))
    const big = await runCapgoAiAnalysis({ apiHost: 'https://api.test', apikey: 'key', jobId: bigJobId, appId: 'com.test.app' })
    expect(big.kind).toBe('too_big')

    await writeFile(join(testDir, 'job-release.log'), 'data')
    await releaseCapturedLogs('job-release')
    expect(existsSync(join(testDir, 'job-release.log'))).toBe(false)
  })
})
