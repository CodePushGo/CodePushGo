import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import packageJson from '../package.json' with { type: 'json' }

function releaseEntrypoints(): string[] {
  const paths = new Set<string>()
  paths.add(packageJson.main)
  for (const binPath of Object.values(packageJson.bin))
    paths.add(binPath)
  return [...paths].map(path => join(__dirname, '..', path))
}

describe('[Capgo parity] release CLI dev gate', () => {
  it('compiled CLI entrypoints do not contain dev-only markers', () => {
    const files = releaseEntrypoints()
    expect(files.length).toBeGreaterThan(0)
    for (const file of files)
      expect(existsSync(file), file).toBe(true)

    const output = files.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const marker of ['__CAPGO_DEV__', 'CAPGO_SPOOF', '__CAPGO_MCP_ONBOARDING__'])
      expect(output).not.toContain(marker)
  })
})
