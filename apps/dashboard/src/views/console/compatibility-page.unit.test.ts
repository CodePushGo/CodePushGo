import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/router.ts'), 'utf8')
const tabsSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/constants/consoleTabs.ts'), 'utf8')
const overviewSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/views/console/ConsoleAppOverviewPage.vue'), 'utf8')
const pageSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/views/console/ConsoleCompatibilityPage.vue'), 'utf8')
const bannerSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/components/dashboard/CompatibilityBanner.vue'), 'utf8')
const migrationSource = readFileSync(join(process.cwd(), 'supabase/migrations/20260611111318_codepushgo_init.sql'), 'utf8')

describe('[Capgo parity] compatibility console surface', () => {
  it('mounts a compatibility app tab and route', () => {
    expect(routerSource).toContain('ConsoleCompatibilityPage')
    expect(routerSource).toContain("{ path: 'compatibility', component: ConsoleCompatibilityPage }")
    expect(tabsSource).toContain("{ label: 'Compatibility', key: '/compatibility', icon: AlertTriangle }")
  })

  it('shows unresolved compatibility events from app overview and a dedicated page', () => {
    expect(overviewSource).toContain('<CompatibilityBanner')
    expect(bannerSource).toContain('countUnresolvedCompatibilityGroups')
    expect(bannerSource).toContain('data-test="compatibility-banner"')
    expect(pageSource).toContain('listCompatibilityEvents')
    expect(pageSource).toContain('groupCompatibilityEvents')
    expect(pageSource).toContain('aria-label="Compatibility events table"')
    expect(pageSource).toContain('Show unresolved only')
  })

  it('allows authenticated org members to read compatibility events through the single migration', () => {
    expect(migrationSource).toContain('compatibility_events_read_member_org_compatibility_events')
    expect(migrationSource).toContain('GRANT SELECT ON TABLE public.compatibility_events TO authenticated')
    expect(migrationSource).toContain('WHERE apps.app_id = compatibility_events.app_id')
  })
})
