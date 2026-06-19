import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('[Capgo parity] dashboard production module loading', () => {
  it('does not bundle module unit tests into the production app', () => {
    const source = readFileSync(join(import.meta.dirname, 'main.ts'), 'utf8')

    expect(source).toContain("import.meta.glob<{ install: UserModule }>(['./modules/*.ts'")
    expect(source).toContain("'!./modules/*.test.ts'")
    expect(source).toContain("'!./modules/*.unit.test.ts'")
    expect(source).not.toContain("import.meta.glob<{ install: UserModule }>('./modules/*.ts'")
  })
})
