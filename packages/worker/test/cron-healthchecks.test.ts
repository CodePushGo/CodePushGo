import { describe, expect, it } from 'vitest'

import { readRootMigrations } from './helpers/migration-sql'

const migration = readRootMigrations()

describe('[Capgo parity] cron healthchecks', () => {
  it.concurrent('stores any healthcheck URL on cron tasks', () => {
    expect(migration).toContain('CREATE TYPE public.cron_task_type AS ENUM')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.cron_tasks')
    expect(migration).toMatch(/healthcheck_url\s+TEXT/i)
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cron_tasks TO service_role')
  })
})
