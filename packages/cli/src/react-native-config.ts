import type { Platform } from '@codepushgo/shared'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface ReactNativeBundleIdResult {
  bundleId: string
  source: string
  platform?: Platform
}

interface ExpoLikeConfig {
  expo?: {
    ios?: { bundleIdentifier?: unknown }
    android?: { package?: unknown }
  }
  ios?: { bundleIdentifier?: unknown }
  android?: { package?: unknown }
}

function readJson(path: string): unknown {
  if (!existsSync(path))
    return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  catch {
    return undefined
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function detectFromAppJson(cwd: string, platform?: Platform): ReactNativeBundleIdResult[] {
  const results: ReactNativeBundleIdResult[] = []
  for (const file of ['app.json', 'app.config.json']) {
    const config = readJson(join(cwd, file)) as ExpoLikeConfig | undefined
    if (!config)
      continue

    const expo = config.expo ?? config
    const ios = stringValue(expo.ios?.bundleIdentifier)
    const android = stringValue(expo.android?.package)

    if ((!platform || platform === 'ios') && ios)
      results.push({ bundleId: ios, source: file, platform: 'ios' })
    if ((!platform || platform === 'android') && android)
      results.push({ bundleId: android, source: file, platform: 'android' })
  }
  return results
}

function detectFromAndroidGradle(cwd: string): ReactNativeBundleIdResult[] {
  const files = [
    join(cwd, 'android/app/build.gradle'),
    join(cwd, 'android/app/build.gradle.kts'),
  ]

  for (const file of files) {
    if (!existsSync(file))
      continue

    const content = readFileSync(file, 'utf8')
    const match = content.match(/applicationId\s*[= ]\s*["']([^"']+)["']/)
    const bundleId = stringValue(match?.[1])
    if (bundleId)
      return [{ bundleId, source: file, platform: 'android' }]
  }

  return []
}

interface PbxprojBundleIdCandidate {
  bundleId: string
  configuration: string
  index: number
}

function cleanPbxprojBundleId(value: string | undefined) {
  const bundleId = value?.trim().replace(/^"|"$/g, '')
  if (!bundleId || bundleId.includes('$('))
    return undefined
  return bundleId
}

export function parsePbxprojBundleIds(content: string): string[] {
  const candidates: PbxprojBundleIdCandidate[] = []
  const matches = [...content.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g)]

  for (const match of matches) {
    const bundleId = cleanPbxprojBundleId(match[1])
    if (!bundleId || match.index === undefined)
      continue

    const before = content.slice(Math.max(0, match.index - 600), match.index)
    const after = content.slice(match.index, Math.min(content.length, match.index + 600))
    const configuration = after.match(/name\s*=\s*([^;]+);/)?.[1]?.trim().replace(/^"|"$/g, '')
      ?? before.match(/\/\*\s*([^*]+?)\s*\*\/[\s\S]*$/)?.[1]?.trim()
      ?? ''

    candidates.push({ bundleId, configuration, index: match.index })
  }

  const unique = [...new Map(candidates.map((candidate) => [candidate.bundleId, candidate])).values()]
  return unique
    .sort((left, right) => {
      const leftRelease = left.configuration.toLowerCase() === 'release'
      const rightRelease = right.configuration.toLowerCase() === 'release'
      if (leftRelease !== rightRelease)
        return leftRelease ? -1 : 1
      if (left.bundleId.length !== right.bundleId.length)
        return left.bundleId.length - right.bundleId.length
      return left.index - right.index
    })
    .map((candidate) => candidate.bundleId)
}

function detectFromIosProject(cwd: string): ReactNativeBundleIdResult[] {
  const iosDir = join(cwd, 'ios')
  if (!existsSync(iosDir))
    return []

  const projects = readdirSync(iosDir).filter((entry) => entry.endsWith('.xcodeproj'))
  for (const project of projects) {
    const pbxproj = join(iosDir, project, 'project.pbxproj')
    if (!existsSync(pbxproj))
      continue

    const bundleIds = parsePbxprojBundleIds(readFileSync(pbxproj, 'utf8'))
    if (bundleIds.length > 0)
      return bundleIds.map((bundleId) => ({ bundleId, source: pbxproj, platform: 'ios' as const }))
  }

  return []
}

export function detectReactNativeBundleIds(cwd = process.cwd(), platform?: Platform): ReactNativeBundleIdResult[] {
  return [
    ...detectFromAppJson(cwd, platform),
    ...(!platform || platform === 'android' ? detectFromAndroidGradle(cwd) : []),
    ...(!platform || platform === 'ios' ? detectFromIosProject(cwd) : []),
  ]
}

export function detectReactNativeBundleId(cwd = process.cwd(), platform?: Platform): ReactNativeBundleIdResult | undefined {
  const results = detectReactNativeBundleIds(cwd, platform)
  if (results.length === 0)
    return undefined

  const exactPlatform = platform ? results.find((result) => result.platform === platform) : undefined
  if (exactPlatform)
    return exactPlatform

  const unique = [...new Map(results.map((result) => [result.bundleId, result])).values()]
  if (unique.length === 1)
    return unique[0]

  return results[0]
}
