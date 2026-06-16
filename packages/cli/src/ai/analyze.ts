import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { cleanupCapturedJobFiles, capturedLogSize, getAiPromptPath, getLogCapturePath } from './log-capture'
import { createSseParser } from './sse'

export const HARD_LOG_SIZE_LIMIT = 1024 * 1024 * 2

export type AnalyzeBehavior = 'show_menu' | 'ask_then_menu' | 'auto_upload' | 'skip'

export type AnalyzeResult =
  | { kind: 'ok', analysis: string }
  | { kind: 'already_analyzed' }
  | { kind: 'too_big' }
  | { kind: 'upgrade_required', message: string }
  | { kind: 'error', message: string, partial?: string }

export interface AnalyzeRequestInput {
  apiHost: string
  apikey: string
  jobId: string
  appId: string
  logs: string
  onChunk?: (chunk: string) => void
}

export function decideAnalyzeBehavior(input: { isTTY: boolean, aiAnalyticsFlag: boolean }): AnalyzeBehavior {
  if (input.isTTY)
    return input.aiAnalyticsFlag ? 'show_menu' : 'ask_then_menu'
  return input.aiAnalyticsFlag ? 'auto_upload' : 'skip'
}

export async function writeLocalAiFile(jobId: string) {
  const logs = await readFile(getLogCapturePath(jobId), 'utf8')
  const path = getAiPromptPath(jobId)
  await writeFile(path, [
    'You are a build engineer helping diagnose a React Native update/build failure.',
    '',
    '<BUILD_LOG>',
    logs.trimEnd(),
    '</BUILD_LOG>',
    '',
  ].join('\n'))
  return path
}

export async function postAnalyzeStreamRequest(input: AnalyzeRequestInput): Promise<AnalyzeResult> {
  const response = await fetch(`${input.apiHost.replace(/\/$/, '')}/build/ai_analyze_stream`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json',
      capgkey: input.apikey,
      authorization: `Bearer ${input.apikey}`,
    },
    body: JSON.stringify({
      jobId: input.jobId,
      appId: input.appId,
      logs: input.logs,
    }),
  })

  if (response.status === 409)
    return { kind: 'already_analyzed' }
  if (response.status === 413)
    return { kind: 'too_big' }
  if (response.status === 426)
    return { kind: 'upgrade_required', message: await readServerMessage(response) }
  if (!response.ok)
    return { kind: 'error', message: await response.text() }
  if (!response.body)
    return { kind: 'error', message: 'empty stream' }

  const decoder = new TextDecoder()
  let analysis = ''
  let done = false
  let streamError: string | null = null
  const feed = createSseParser((event) => {
    if (event.event === 'chunk') {
      const parsed = parseJson(event.data)
      const text = typeof parsed.text === 'string' ? parsed.text : event.data
      analysis += text
      input.onChunk?.(text)
    }
    else if (event.event === 'done') {
      done = true
    }
    else if (event.event === 'error') {
      const parsed = parseJson(event.data)
      streamError = typeof parsed.code === 'string' ? parsed.code : event.data
    }
  })

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>)
    feed(decoder.decode(chunk, { stream: true }))

  const tail = decoder.decode()
  if (tail)
    feed(tail)

  if (streamError)
    return { kind: 'error', message: streamError, partial: analysis }
  if (!done)
    return { kind: 'error', message: 'stream ended before done', partial: analysis }
  return { kind: 'ok', analysis }
}

export async function runCapgoAiAnalysis(input: Omit<AnalyzeRequestInput, 'logs'>) {
  const logPath = getLogCapturePath(input.jobId)
  if (!existsSync(logPath))
    return { kind: 'error', message: 'captured log missing' } satisfies AnalyzeResult
  const size = await capturedLogSize(input.jobId)
  if (size !== null && size > HARD_LOG_SIZE_LIMIT)
    return { kind: 'too_big' } satisfies AnalyzeResult
  const logs = await readFile(logPath, 'utf8')
  return postAnalyzeStreamRequest({ ...input, logs })
}

export async function releaseCapturedLogs(jobId: string) {
  await cleanupCapturedJobFiles(jobId, { keepAiPromptFile: false })
}

async function readServerMessage(response: Response) {
  const text = await response.text()
  const parsed = parseJson(text)
  return typeof parsed.error === 'string' ? parsed.error : text
}

function parseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>
  }
  catch {
    return {}
  }
}
