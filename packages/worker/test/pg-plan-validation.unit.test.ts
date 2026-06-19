import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

function functionSql(name: string) {
  const start = migrationSql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = migrationSql.indexOf('\n$$;', start)
  expect(end).toBeGreaterThan(start)
  return migrationSql.slice(start, end)
}

describe('[Capgo parity] plan validation SQL', () => {
  it('keeps current plan lookup on Capgo org stripe info without past_due special casing', () => {
    const sql = functionSql('get_current_plan_name_org')

    expect(sql).toContain('JOIN public.stripe_info si ON o.customer_id = si.customer_id')
    expect(sql).toContain('JOIN public.plans p ON si.product_id = p.stripe_id')
    expect(sql).not.toContain('past_due')
  })
})
