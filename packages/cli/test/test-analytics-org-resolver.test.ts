import { beforeEach, describe, expect, it } from 'vitest'
import { clearOwnerOrgCache, resolveOwnerOrgId } from '../src/analytics/org-resolver'

describe('[Capgo parity] analytics org resolver', () => {
  beforeEach(() => clearOwnerOrgCache())

  it('resolves and caches owner org from app list responses', async () => {
    let calls = 0
    const api = {
      async listApps() {
        calls++
        return { apps: [{ app_id: 'com.example.app', owner_org: 'org-1' }] }
      },
    }

    await expect(resolveOwnerOrgId({ appId: 'com.example.app', api })).resolves.toBe('org-1')
    await expect(resolveOwnerOrgId({ appId: 'com.example.app', api })).resolves.toBe('org-1')
    expect(calls).toBe(1)
  })

  it('returns undefined instead of throwing on lookup failures', async () => {
    await expect(resolveOwnerOrgId({
      appId: 'com.example.app',
      api: { async listApps() { throw new Error('network') } },
    })).resolves.toBeUndefined()
  })
})
