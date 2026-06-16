import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function jsFiles(root: string): string[] {
  if (!existsSync(root))
    return []
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry)
    const stats = statSync(path)
    if (stats.isDirectory())
      return jsFiles(path)
    return entry.endsWith('.js') ? [path] : []
  })
}

describe('[Capgo parity] release CLI dev gate', () => {
  it('compiled CLI output does not contain dev-only markers', () => {
    const files = jsFiles(join(__dirname, '../dist'))
    expect(files.length).toBeGreaterThan(0)
    const output = files.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const marker of ['__CAPGO_DEV__', 'CAPGO_SPOOF', '__CAPGO_MCP_ONBOARDING__'])
      expect(output).not.toContain(marker)
  })
})
