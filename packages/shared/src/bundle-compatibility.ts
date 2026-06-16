import { compareVersions, parseVersion } from './semver'

export interface NativePackage {
  name: string
  version: string
  ios_checksum?: string
  android_checksum?: string
}

export type PackageCompatibilityStatus = 'added' | 'removed' | 'changed' | 'unchanged'

export interface PackageCompatibilityComparison {
  name: string
  status: PackageCompatibilityStatus
  compatible: boolean
  reasons: string[]
  candidateVersion?: string
  baselineVersion?: string
}

export interface BundleCompatibilitySummary {
  compatible: boolean
  incompatibleCount: number
  offenders: string[]
}

export interface DeploymentRecord {
  id: number
  version_id: number
  deployed_at: string
}

export interface DeploymentPair {
  current: DeploymentRecord
  previous: DeploymentRecord
}

export const BUNDLE_INCOMPATIBLE_EVENT = 'Bundle Incompatible'

export interface BundleCompatibilityBentoEventInput {
  event?: string
  orgId?: string
  appId?: string
  channelOverwritten?: boolean
  channel?: string
  source?: string
  versionNewId?: string
  versionNewName?: string
  versionOldId?: string
  versionOldName?: string
  orgName?: string
  appName?: string
}

export interface BundleCompatibilityBentoEvent {
  event: 'bundle_incompatible'
  preferenceKey: 'bundle_incompatible'
  once: true
  uniqId: string
  data: Record<string, string>
}

function packageMap(packages: NativePackage[]) {
  return new Map(packages.map((item) => [item.name, item]))
}

function cleanRange(version: string) {
  return version.trim().replace(/^[~^]/, '')
}

function sameMajor(candidate: string, baseline: string) {
  const candidateVersion = parseVersion(cleanRange(candidate))
  const baselineVersion = parseVersion(cleanRange(baseline))
  return !!candidateVersion && !!baselineVersion && candidateVersion.major === baselineVersion.major
}

function sameMinor(candidate: string, baseline: string) {
  const candidateVersion = parseVersion(cleanRange(candidate))
  const baselineVersion = parseVersion(cleanRange(baseline))
  return !!candidateVersion
    && !!baselineVersion
    && candidateVersion.major === baselineVersion.major
    && candidateVersion.minor === baselineVersion.minor
}

function versionIntersects(candidate: string, baseline: string) {
  if (candidate === baseline)
    return true
  if (baseline.startsWith('^'))
    return sameMajor(candidate, baseline) && compareVersions(cleanRange(candidate), cleanRange(baseline)) >= 0
  if (candidate.startsWith('^'))
    return sameMajor(candidate, baseline) && compareVersions(cleanRange(baseline), cleanRange(candidate)) >= 0
  if (baseline.startsWith('~'))
    return sameMinor(candidate, baseline) && compareVersions(cleanRange(candidate), cleanRange(baseline)) >= 0
  if (candidate.startsWith('~'))
    return sameMinor(candidate, baseline) && compareVersions(cleanRange(baseline), cleanRange(candidate)) >= 0
  return false
}

function checksumReasons(candidate: NativePackage, baseline: NativePackage) {
  const iosChanged = !!candidate.ios_checksum && !!baseline.ios_checksum && candidate.ios_checksum !== baseline.ios_checksum
  const androidChanged = !!candidate.android_checksum && !!baseline.android_checksum && candidate.android_checksum !== baseline.android_checksum
  if (iosChanged && androidChanged)
    return ['both_platforms_changed']
  if (iosChanged)
    return ['ios_code_changed']
  if (androidChanged)
    return ['android_code_changed']
  return []
}

function statusRank(status: PackageCompatibilityStatus) {
  return ({ changed: 0, added: 1, removed: 2, unchanged: 3 })[status]
}

export function compareNativePackages(candidatePackages: NativePackage[], baselinePackages: NativePackage[]): PackageCompatibilityComparison[] {
  const candidate = packageMap(candidatePackages)
  const baseline = packageMap(baselinePackages)
  const names = Array.from(new Set([...candidate.keys(), ...baseline.keys()]))
  const comparisons = names.map((name): PackageCompatibilityComparison => {
    const candidatePackage = candidate.get(name)
    const baselinePackage = baseline.get(name)

    if (candidatePackage && !baselinePackage) {
      return {
        name,
        status: 'added',
        compatible: false,
        reasons: ['new_plugin'],
        candidateVersion: candidatePackage.version,
      }
    }

    if (!candidatePackage && baselinePackage) {
      return {
        name,
        status: 'removed',
        compatible: true,
        reasons: [],
        baselineVersion: baselinePackage.version,
      }
    }

    const current = candidatePackage as NativePackage
    const previous = baselinePackage as NativePackage
    const reasons = [
      ...(versionIntersects(current.version, previous.version) ? [] : ['version_mismatch']),
      ...checksumReasons(current, previous),
    ]
    const status = reasons.length > 0 ? 'changed' : 'unchanged'
    return {
      name,
      status,
      compatible: reasons.length === 0,
      reasons,
      candidateVersion: current.version,
      baselineVersion: previous.version,
    }
  })

  return comparisons.sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name))
}

export const comparePackages = compareNativePackages

export function summarizeBundleCompatibility(comparisons: PackageCompatibilityComparison[]): BundleCompatibilitySummary {
  const offenders = comparisons.filter((item) => !item.compatible).map((item) => item.name)
  return {
    compatible: offenders.length === 0,
    incompatibleCount: offenders.length,
    offenders,
  }
}

export const summarizeCompatibility = summarizeBundleCompatibility

export function selectCurrentDeploymentPair(history: DeploymentRecord[], currentVersionId: number): DeploymentPair | undefined {
  const sorted = [...history].sort((a, b) => b.deployed_at.localeCompare(a.deployed_at))
  const currentIndex = sorted.findIndex((item) => item.version_id === currentVersionId)
  if (currentIndex < 0)
    return undefined
  const previous = sorted[currentIndex + 1]
  if (!previous)
    return undefined
  return { current: sorted[currentIndex], previous }
}

export function buildBundleCompatibilityBentoEvent(input: BundleCompatibilityBentoEventInput): BundleCompatibilityBentoEvent | undefined {
  if (input.event !== BUNDLE_INCOMPATIBLE_EVENT)
    return undefined
  if (input.channelOverwritten !== true)
    return undefined
  if (!input.orgId || !input.appId)
    return undefined

  const channel = input.channel ?? ''
  const versionKey = input.versionNewName ?? input.versionOldName ?? ''
  return {
    event: 'bundle_incompatible',
    preferenceKey: 'bundle_incompatible',
    once: true,
    uniqId: `bundle_incompatible:${input.appId}:${channel}:${versionKey}`,
    data: {
      org_id: input.orgId,
      org_name: input.orgName ?? '',
      app_id: input.appId,
      app_name: input.appName ?? '',
      channel,
      source: input.source ?? 'unknown',
      version_new_id: input.versionNewId ?? '',
      version_new_name: input.versionNewName ?? '',
      version_old_id: input.versionOldId ?? '',
      version_old_name: input.versionOldName ?? '',
    },
  }
}
