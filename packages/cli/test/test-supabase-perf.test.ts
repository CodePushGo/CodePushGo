import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('[Capgo parity] Supabase perf boundary', () => {
  it('does not add Supabase edge functions to the RN CodePushGo repo', () => {
    expect(existsSync(new URL('../../../supabase/functions', import.meta.url))).toBe(false)
    const workflow = readFileSync(new URL('../../../.github/workflows/deploy_worker.yml', import.meta.url), 'utf8')
    expect(workflow).not.toContain('supabase functions deploy')
  })
})
