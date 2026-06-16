import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
export interface CodePushGoConfig {
  appId?: string
  endpoint?: string
  token?: string
  channel?: string
  publicKey?: string
}

export const configFileName = 'codepushgo.config.json'

export async function loadConfig(cwd = process.cwd()): Promise<CodePushGoConfig> {
  try {
    const raw = await readFile(join(cwd, configFileName), 'utf8')
    return JSON.parse(raw) as CodePushGoConfig
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return {}
    throw error
  }
}

export async function writeConfig(config: CodePushGoConfig, cwd = process.cwd()) {
  await writeFile(join(cwd, configFileName), `${JSON.stringify(config, null, 2)}\n`)
}

export function requireValue(value: string | undefined, name: string): string {
  if (!value)
    throw new Error(`${name} is required`)
  return value
}
