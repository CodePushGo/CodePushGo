import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('[Capgo parity] CLI functional bundle smoke', () => {
  it('keeps the React Native CLI package shaped for publishing', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    expect(pkg.name).toBe('@codepushgo/cli')
    expect(pkg.bin.codepushgo).toBe('dist/index.js')
    expect(pkg.dependencies.commander).toBeTruthy()
    expect(pkg.dependencies['@codepushgo/shared']).toBe('workspace:*')
  })

  it('keeps command handlers out of the entrypoint', () => {
    const entrypoint = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(entrypoint).toContain("program.command('init')")
    expect(entrypoint).toContain('handleInit')
    expect(entrypoint).not.toContain('async function handleInit')
    expect(existsSync(new URL('../src/commands.ts', import.meta.url))).toBe(true)
  })
})
