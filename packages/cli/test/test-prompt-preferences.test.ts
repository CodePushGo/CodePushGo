import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getRememberedPromptPreference, rememberPromptPreference, rememberPromptPreferenceSafely } from '../src/prompt-preferences'

const testDir = join(tmpdir(), `codepushgo-prompt-prefs-${Date.now()}`)
const prefsPath = join(testDir, '.codepushgo-prompt-preferences.json')

describe('[Capgo parity] prompt preference persistence', () => {
  beforeAll(async () => { await mkdir(testDir, { recursive: true }) })
  afterAll(async () => { await rm(testDir, { recursive: true, force: true }) })

  it('returns undefined when missing, persists choices, and ignores invalid JSON', async () => {
    expect(await getRememberedPromptPreference('uploadStarCodePushGoRepo', prefsPath)).toBeUndefined()
    await rememberPromptPreference('uploadStarCodePushGoRepo', false, prefsPath)
    await rememberPromptPreference('uploadShowReplicationProgress', true, prefsPath)
    expect(await getRememberedPromptPreference('uploadStarCodePushGoRepo', prefsPath)).toBe(false)
    expect(JSON.parse(readFileSync(prefsPath, 'utf8'))).toMatchObject({ uploadStarCodePushGoRepo: false, uploadShowReplicationProgress: true })
    writeFileSync(prefsPath, '{not-json', 'utf8')
    expect(await getRememberedPromptPreference('uploadStarCodePushGoRepo', prefsPath)).toBeUndefined()
  })

  it('safe persistence swallows write errors', async () => {
    const brokenParent = join(testDir, 'broken-parent')
    writeFileSync(brokenParent, 'not-a-directory', 'utf8')
    const brokenPath = join(brokenParent, '.codepushgo-prompt-preferences.json')
    await rememberPromptPreferenceSafely('uploadStarCodePushGoRepo', true, brokenPath)
    expect(existsSync(brokenPath)).toBe(false)
  })
})
