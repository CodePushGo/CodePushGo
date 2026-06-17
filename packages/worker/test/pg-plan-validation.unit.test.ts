import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

function functionSql(name: string) {
  const start = migrationSql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = migrationSql.indexOf('\n$$;', start)
  expect(end).toBeGreaterThan(start)
  return migrationSql.slice(start, end)
}

describe('[Capgo parity] plan validation SQL', () => {
  it('keeps current plan checks limited to succeeded subscriptions', () => {
    const sql = functionSql('get_current_plan_name_org')

    expect(sql).toContain("stripe_info.status = 'succeeded'")
    expect(sql).not.toContain('past_due')
  })
})
