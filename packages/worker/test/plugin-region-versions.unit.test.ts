import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerApp, MemoryStorage, type Env } from '../src/index'
import { PLUGIN_REGIONS, type PluginRegion } from '../src/plugin-regions'

const API_SECRET = 'test-secret'
const originalFetch = globalThis.fetch

describe('[Capgo parity] plugin region versions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('requires the apisecret header', async () => {
    const response = await requestPluginRegions('/plugin_regions', false)

    expect(response.status).toBe(400)
    expect(await response.text()).toContain('Cannot find authorization')
  })

  it('returns ok when every region serves the same worker version', async () => {
    mockRegionFetch(new Map(PLUGIN_REGIONS.map(region => [region.name, '1.2.3'])))

    const response = await requestPluginRegions()
    const body = await response.json() as { status: string, version: string, regions: unknown[] }

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.version).toBe('1.2.3')
    expect(body.regions).toHaveLength(PLUGIN_REGIONS.length)
  })

  it('supports the /versions alias', async () => {
    mockRegionFetch(new Map(PLUGIN_REGIONS.map(region => [region.name, '2.0.0'])))

    const response = await requestPluginRegions('/plugin_regions/versions')
    const body = await response.json() as { status: string, version: string }

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.version).toBe('2.0.0')
  })

  it('returns mismatch when a reachable region serves another version', async () => {
    const versions = new Map(PLUGIN_REGIONS.map(region => [region.name, '1.2.3']))
    versions.set('na', '1.2.4')
    mockRegionFetch(versions)

    const response = await requestPluginRegions()
    const body = await response.json() as { status: string, expectedVersion: string, differences: Array<{ name: string, version: string, expectedVersion: string }> }

    expect(response.status).toBe(409)
    expect(body.status).toBe('mismatch')
    expect(body.expectedVersion).toBe('1.2.3')
    expect(body.differences).toEqual([
      expect.objectContaining({ name: 'na', version: '1.2.4', expectedVersion: '1.2.3' }),
    ])
  })

  it('returns indeterminate when no unique expected version exists', async () => {
    const versions = new Map(PLUGIN_REGIONS.map((region, index) => [region.name, index % 2 === 0 ? '1.0.0' : '2.0.0']))
    versions.delete('sa')
    mockRegionFetch(versions)

    const response = await requestPluginRegions()
    const body = await response.json() as { status: string, version: string | null }

    expect(response.status).toBe(200)
    expect(body.status).toBe('indeterminate')
    expect(body.version).toBeNull()
  })

  it('returns indeterminate with unavailable regions when successful regions agree', async () => {
    const versions = new Map(PLUGIN_REGIONS.map(region => [region.name, '3.0.0']))
    versions.set('jp', 'throw')
    mockRegionFetch(versions)

    const response = await requestPluginRegions()
    const body = await response.json() as { status: string, version: string, unavailableRegions: Array<{ name: string, error: string }> }

    expect(response.status).toBe(200)
    expect(body.status).toBe('indeterminate')
    expect(body.version).toBe('3.0.0')
    expect(body.unavailableRegions).toEqual([
      expect.objectContaining({ name: 'jp', error: 'region unavailable' }),
    ])
  })
})

function requestPluginRegions(path = '/plugin_regions', includeSecret = true) {
  const app = createWorkerApp(() => new MemoryStorage())
  return app.request(`http://local${path}`, {
    headers: includeSecret ? { apisecret: API_SECRET } : undefined,
  }, {
    CODEPUSHGO_API_KEY: 'test-token',
    API_SECRET,
  } satisfies Env)
}

function mockRegionFetch(versions: Map<string, string>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
    const region = PLUGIN_REGIONS.find(candidate => getRequestUrl(url) === candidate.url)
    if (!region)
      return new Response('{}', { status: 404 })

    const version = versions.get(region.name)
    if (version === 'throw')
      throw new Error('region unavailable')
    if (!version)
      return regionResponse(region, null, 503)
    return regionResponse(region, version, 200)
  }))
}

function regionResponse(region: PluginRegion, version: string | null, status: number) {
  const headers = new Headers()
  if (version)
    headers.set('x-worker-source', `${region.envName}-${version}`)
  return new Response(JSON.stringify({ status: 'ok' }), { status, headers })
}

function getRequestUrl(input: string | URL | Request) {
  if (input instanceof Request)
    return input.url
  return input.toString()
}
