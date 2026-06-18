import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/router.ts'), 'utf8')

describe('[Capgo parity] Vue Router console pages', () => {
  it('mounts console pages through a shared shell route', () => {
    expect(routerSource).toContain('export const consoleRoutes')
    expect(routerSource).toContain("path: '/'")
    expect(routerSource).toContain('component: ConsoleView')
    expect(routerSource).toContain("meta: { middleware: 'auth' }")
  })

  it('maps canonical console paths through dedicated route layouts and page components', () => {
    expect(routerSource).toContain("{ path: 'apps', component: ConsoleHomePage }")
    expect(routerSource).toContain("{ path: 'app/home', component: ConsoleHomePage }")
    expect(routerSource).toContain('component: ConsoleAppLayout')
    expect(routerSource).toContain("{ path: '', component: ConsoleAppOverviewPage }")
    expect(routerSource).toContain("{ path: 'bundles', component: ConsoleBundlesPage }")
    expect(routerSource).toContain("{ path: 'channels', component: ConsoleChannelsPage }")
    expect(routerSource).toContain("{ path: 'devices', component: ConsoleDevicesPage }")
    expect(routerSource).toContain("{ path: 'logs', component: ConsoleStatsPage }")
    expect(routerSource).toContain("{ path: 'dashboard/apikeys', component: ConsoleApiKeysPage }")
    expect(routerSource).toContain('component: ConsoleSettingsLayout')
    expect(routerSource).toContain("{ path: 'dashboard/settings/:pathMatch(.*)*', redirect: '/settings/organization/plans' }")
    expect(routerSource).toContain("{ path: 'organization/:pathMatch(.*)*', component: ConsoleSettingsPage }")
  })

  it('does not register broad top-level console catchalls before page routes', () => {
    expect(routerSource).not.toContain("{ path: '/apps', component: ConsoleView")
    expect(routerSource).not.toContain("{ path: '/app/:appId/:pathMatch(.*)*', component: ConsoleView")
  })
})
