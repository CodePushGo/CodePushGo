import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/router.ts'), 'utf8')
const pageSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/views/console/ConsoleApiKeysPage.vue'), 'utf8')
const serviceSource = readFileSync(join(process.cwd(), 'apps/dashboard/src/services/apikeys.ts'), 'utf8')

describe('[Capgo parity] API keys console surface', () => {
  it('mounts API keys and redirects organization API-key routes like Capgo', () => {
    expect(routerSource).toContain("{ path: 'dashboard/apikeys', component: ConsoleApiKeysPage }")
    expect(routerSource).toContain("{ path: 'organization/api-keys', redirect: '/dashboard/apikeys' }")
  })

  it('keeps the Capgo API-key page behaviors on the CodePushGo Worker API', () => {
    expect(pageSource).toContain('listApiKeys')
    expect(pageSource).toContain('createApiKey')
    expect(pageSource).toContain('updateApiKey')
    expect(pageSource).toContain('regenerateApiKey')
    expect(pageSource).toContain('deleteApiKey')
    expect(pageSource).toContain('oneTimeKey')
    expect(pageSource).toContain('aria-label="API keys table"')
    expect(pageSource).toContain('Allow organization creation')
  })

  it('uses Worker routes instead of Supabase Edge Functions', () => {
    expect(serviceSource).toContain("buildApiKeyPath('/apikey'")
    expect(serviceSource).toContain('webhookHeaders(options.apiKey)')
    expect(serviceSource).not.toContain('functions.invoke')
    expect(serviceSource).not.toContain('supabase/functions')
  })
})
