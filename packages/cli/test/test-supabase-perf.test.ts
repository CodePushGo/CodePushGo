import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('[Capgo parity] Supabase perf boundary', () => {
  it('does not add Supabase edge functions to the RN CodePushGo repo', () => {
    expect(existsSync(new URL('../../../supabase/functions', import.meta.url))).toBe(false)
  })
})
