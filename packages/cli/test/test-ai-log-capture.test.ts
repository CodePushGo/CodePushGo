import { existsSync, readFileSync, statSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appendCapturedLine, cleanupCapturedJobFiles, getLogCapturePath, shouldCaptureLogs, startCaptureForJob } from '../src/ai/log-capture'

const testDir = join(tmpdir(), `codepushgo-ai-log-test-${Date.now()}`)
const jobId = 'job-test-abc'

describe('[Capgo parity] AI log capture', () => {
  beforeAll(async () => {
    process.env.CODEPUSHGO_AI_LOG_BASE_DIR = testDir
    await mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    delete process.env.CODEPUSHGO_AI_LOG_BASE_DIR
    await rm(testDir, { recursive: true, force: true })
  })

  it('uses the configured base directory and TTY capture gate', () => {
    expect(getLogCapturePath(jobId)).toBe(join(testDir, `${jobId}.log`))
    expect(shouldCaptureLogs({ isTTY: false })).toBe(false)
    expect(shouldCaptureLogs({ isTTY: true })).toBe(true)
  })

  it('creates, appends, and cleans captured logs', async () => {
    await startCaptureForJob(jobId)
    expect(existsSync(getLogCapturePath(jobId))).toBe(true)
    expect(statSync(getLogCapturePath(jobId)).size).toBe(0)

    await appendCapturedLine(jobId, 'first line')
    await appendCapturedLine(jobId, 'second line')
    expect(readFileSync(getLogCapturePath(jobId), 'utf8')).toBe('first line\nsecond line\n')

    await cleanupCapturedJobFiles(jobId)
    expect(existsSync(getLogCapturePath(jobId))).toBe(false)
  })

  it('preserves local prompt files when requested', async () => {
    await startCaptureForJob(jobId)
    const promptPath = join(testDir, `${jobId}.ai-prompt.txt`)
    await writeFile(promptPath, 'prompt')
    await cleanupCapturedJobFiles(jobId, { keepAiPromptFile: true })
    expect(existsSync(getLogCapturePath(jobId))).toBe(false)
    expect(existsSync(promptPath)).toBe(true)
  })
})
