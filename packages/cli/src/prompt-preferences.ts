import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export type PromptPreferenceKey = 'uploadStarCodePushGoRepo' | 'uploadShowReplicationProgress' | 'aiAnalyzeBuildLogs'
export const defaultPromptPreferencesPath = join(homedir(), '.codepushgo-prompt-preferences.json')

type PromptPreferences = Partial<Record<PromptPreferenceKey, boolean>>

async function readPreferences(path: string): Promise<PromptPreferences> {
  if (!existsSync(path))
    return {}
  try {
    return JSON.parse(await readFile(path, 'utf8')) as PromptPreferences
  }
  catch {
    return {}
  }
}

export async function getRememberedPromptPreference(key: PromptPreferenceKey, path = defaultPromptPreferencesPath) {
  return (await readPreferences(path))[key]
}

export async function rememberPromptPreference(key: PromptPreferenceKey, value: boolean, path = defaultPromptPreferencesPath) {
  const preferences = await readPreferences(path)
  preferences[key] = value
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(preferences, null, 2)}\n`)
}

export async function rememberPromptPreferenceSafely(key: PromptPreferenceKey, value: boolean, path = defaultPromptPreferencesPath) {
  try {
    await rememberPromptPreference(key, value, path)
  }
  catch {
    // Prompt preferences must never break CLI flows.
  }
}
