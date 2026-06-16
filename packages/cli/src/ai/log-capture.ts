import { existsSync } from 'node:fs'
import { appendFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function getLogCaptureBaseDir() {
  return process.env.CODEPUSHGO_AI_LOG_BASE_DIR ?? process.env.CAPGO_AI_LOG_BASE_DIR ?? join(tmpdir(), 'codepushgo-builds')
}

export function getLogCapturePath(jobId: string) {
  return join(getLogCaptureBaseDir(), `${jobId}.log`)
}

export function getAiPromptPath(jobId: string) {
  return join(getLogCaptureBaseDir(), `${jobId}.ai-prompt.txt`)
}

export function shouldCaptureLogs(stdout: Pick<NodeJS.WriteStream, 'isTTY'> = process.stdout) {
  return stdout.isTTY === true
}

export async function startCaptureForJob(jobId: string) {
  const path = getLogCapturePath(jobId)
  await mkdir(getLogCaptureBaseDir(), { recursive: true })
  await writeFile(path, '')
  return path
}

export async function appendCapturedLine(jobId: string, line: string) {
  await appendFile(getLogCapturePath(jobId), `${line}\n`)
}

export async function cleanupCapturedJobFiles(jobId: string, options: { keepAiPromptFile?: boolean } = {}) {
  await rm(getLogCapturePath(jobId), { force: true })
  if (!options.keepAiPromptFile)
    await rm(getAiPromptPath(jobId), { force: true })
}

export async function capturedLogSize(jobId: string) {
  const path = getLogCapturePath(jobId)
  if (!existsSync(path))
    return null
  return (await stat(path)).size
}
