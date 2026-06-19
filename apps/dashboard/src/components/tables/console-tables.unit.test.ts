import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('[Capgo parity] console table components', () => {
  it('keeps table markup in reusable table components instead of route pages', () => {
    const tableComponents = [
      ['apps/dashboard/src/components/tables/AppTable.vue', 'aria-label="Apps table"'],
      ['apps/dashboard/src/components/tables/BuildTable.vue', 'aria-label="Builds table"'],
      ['apps/dashboard/src/components/tables/BundleTable.vue', 'aria-label="Release table"'],
      ['apps/dashboard/src/components/tables/ChannelTable.vue', 'aria-label="Channels table"'],
      ['apps/dashboard/src/components/tables/DeviceTable.vue', 'aria-label="Devices table"'],
      ['apps/dashboard/src/components/tables/LogTable.vue', 'aria-label="Stats table"'],
    ]

    tableComponents.forEach(([path, label]) => {
      expect(source(path)).toContain(label)
      expect(source(path)).toContain('table-toolbar')
    })

    const appTable = source('apps/dashboard/src/components/tables/AppTable.vue')
    expect(appTable).toContain('Search apps')
    expect(appTable).toContain('/app/${encodeURIComponent(app.app_id)}')

    const buildTable = source('apps/dashboard/src/components/tables/BuildTable.vue')
    expect(buildTable).toContain('Cloud build is not enabled')
    expect(buildTable).toContain('Copy upload command')

    const bundleTable = source('apps/dashboard/src/components/tables/BundleTable.vue')
    expect(bundleTable).toContain('RouterLink')
    expect(bundleTable).toContain('appId: string')
    expect(bundleTable).toContain('function bundleKey')
    expect(bundleTable).toContain('/bundle/')
    expect(bundleTable).toContain('Filter bundles by platform')

    const channelTable = source('apps/dashboard/src/components/tables/ChannelTable.vue')
    expect(channelTable).toContain('RouterLink')
    expect(channelTable).toContain('appId: string')
    expect(channelTable).toContain('function channelKey')
    expect(channelTable).toContain('/channel/')
    expect(channelTable).toContain('Filter channels by visibility')

    const deviceTable = source('apps/dashboard/src/components/tables/DeviceTable.vue')
    expect(deviceTable).toContain('RouterLink')
    expect(deviceTable).toContain('appId: string')
    expect(deviceTable).toContain('function deviceKey')
    expect(deviceTable).toContain('/device/')
    expect(deviceTable).toContain('Filter devices by platform')

    const pageFiles = [
      'apps/dashboard/src/views/console/ConsoleBundlesPage.vue',
      'apps/dashboard/src/views/console/ConsoleChannelsPage.vue',
      'apps/dashboard/src/views/console/ConsoleDevicesPage.vue',
      'apps/dashboard/src/views/console/ConsoleStatsPage.vue',
      'apps/dashboard/src/views/console/ConsoleBuildsPage.vue',
    ]

    pageFiles.forEach((path) => {
      const content = source(path)
      expect(content).not.toContain('<table')
      expect(content).not.toContain('<thead>')
      expect(content).not.toContain('<tbody>')
    })
  })
})
