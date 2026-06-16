export interface PluginRegion {
  name: 'eu' | 'me' | 'hk' | 'jp' | 'as' | 'na' | 'af' | 'oc' | 'sa'
  envName: string
  url: string
}

export interface PluginRegionResult {
  name: PluginRegion['name']
  url: string
  status: number | null
  workerSource: string | null
  version: string | null
  error: string | null
}

export interface PluginRegionDifference extends PluginRegionResult {
  expectedVersion: string | null
}

export const PLUGIN_REGIONS: PluginRegion[] = [
  { name: 'eu', envName: 'codepushgo_plugin-eu-prod', url: 'https://plugin.eu.codepushgo.app/ok' },
  { name: 'me', envName: 'codepushgo_plugin-me-prod', url: 'https://plugin.me.codepushgo.app/ok' },
  { name: 'hk', envName: 'codepushgo_plugin-hk-prod', url: 'https://plugin.hk.codepushgo.app/ok' },
  { name: 'jp', envName: 'codepushgo_plugin-jp-prod', url: 'https://plugin.jp.codepushgo.app/ok' },
  { name: 'as', envName: 'codepushgo_plugin-as-prod', url: 'https://plugin.as.codepushgo.app/ok' },
  { name: 'na', envName: 'codepushgo_plugin-na-prod', url: 'https://plugin.na.codepushgo.app/ok' },
  { name: 'af', envName: 'codepushgo_plugin-af-prod', url: 'https://plugin.af.codepushgo.app/ok' },
  { name: 'oc', envName: 'codepushgo_plugin-oc-prod', url: 'https://plugin.oc.codepushgo.app/ok' },
  { name: 'sa', envName: 'codepushgo_plugin-sa-prod', url: 'https://plugin.sa.codepushgo.app/ok' },
]

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown fetch error'
}

export function parseWorkerVersion(workerSource: string | null, envName: string) {
  if (!workerSource)
    return null
  const prefix = `${envName}-`
  return workerSource.startsWith(prefix) ? workerSource.slice(prefix.length) : null
}

export async function fetchPluginRegionVersion(region: PluginRegion): Promise<PluginRegionResult> {
  try {
    const response = await fetch(region.url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    })
    const workerSource = response.headers.get('x-worker-source')
    const version = parseWorkerVersion(workerSource, region.envName)
    let error: string | null = null
    if (!response.ok)
      error = 'http_error'
    else if (!workerSource)
      error = 'missing_worker_source'
    else if (!version)
      error = 'unexpected_worker_source'

    return {
      name: region.name,
      url: region.url,
      status: response.status,
      workerSource,
      version,
      error,
    }
  }
  catch (error) {
    return {
      name: region.name,
      url: region.url,
      status: null,
      workerSource: null,
      version: null,
      error: toErrorMessage(error),
    }
  }
}

export function getExpectedPluginRegionVersion(results: PluginRegionResult[]) {
  const counts = new Map<string, number>()
  for (const result of results) {
    if (!result.version || result.error)
      continue
    counts.set(result.version, (counts.get(result.version) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!sorted.length)
    return null
  if (sorted[1] && sorted[0]![1] === sorted[1][1])
    return null
  return sorted[0]![0]
}

export function getPluginRegionDifferences(results: PluginRegionResult[], expectedVersion: string | null): PluginRegionDifference[] {
  if (!expectedVersion)
    return []
  return results
    .filter(result => !result.error && result.version !== expectedVersion)
    .map(result => ({ ...result, expectedVersion }))
}

export async function getPluginRegionVersions(regions = PLUGIN_REGIONS) {
  const results = await Promise.all(regions.map(fetchPluginRegionVersion))
  const expectedVersion = getExpectedPluginRegionVersion(results)
  const differences = getPluginRegionDifferences(results, expectedVersion)
  const unavailableRegions = results.filter(result => !!result.error)

  if (!expectedVersion) {
    return {
      statusCode: 200,
      body: { status: 'indeterminate', version: null, regions: results },
    }
  }

  if (differences.length) {
    return {
      statusCode: 409,
      body: { status: 'mismatch', expectedVersion, differences, regions: results },
    }
  }

  if (unavailableRegions.length) {
    return {
      statusCode: 200,
      body: { status: 'indeterminate', version: expectedVersion, unavailableRegions, regions: results },
    }
  }

  return {
    statusCode: 200,
    body: { status: 'ok', version: expectedVersion, regions: results },
  }
}
