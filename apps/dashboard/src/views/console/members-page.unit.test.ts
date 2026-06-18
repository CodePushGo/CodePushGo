import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/router.ts'), 'utf8')
const tabsSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/constants/consoleTabs.ts'), 'utf8')
const pageSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/views/console/ConsoleOrganizationMembersPage.vue'), 'utf8')
const serviceSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/services/organizationMembers.ts'), 'utf8')

describe('[Capgo parity] organization members console surface', () => {
  it('mounts members as a dedicated organization settings route and tab', () => {
    expect(routerSource).toContain('ConsoleOrganizationMembersPage')
    expect(routerSource).toContain("{ path: 'organization/members', component: ConsoleOrganizationMembersPage }")
    expect(tabsSource).toContain("{ label: 'Members', key: '/settings/organization/members', icon: Users }")
  })

  it('keeps the Capgo members page behaviors on the CodePushGo Worker API', () => {
    expect(pageSource).toContain('listOrganizationMembers')
    expect(pageSource).toContain('upsertOrganizationMember')
    expect(pageSource).toContain('deleteOrganizationMember')
    expect(pageSource).toContain('filteredMembers')
    expect(pageSource).toContain('aria-label="Organization members table"')
    expect(pageSource).toContain('Add organization member')
    expect(pageSource).toContain('Member role')
  })

  it('uses Worker routes instead of Supabase Edge Functions', () => {
    expect(serviceSource).toContain("buildWebhookApiPath('/organization/members'")
    expect(serviceSource).toContain('webhookHeaders(options.apiKey)')
    expect(serviceSource).not.toContain('functions.invoke')
    expect(serviceSource).not.toContain('supabase/functions')
  })
})
