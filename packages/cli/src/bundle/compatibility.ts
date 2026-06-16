export type IncompatibilityReason = 'new_plugin' | 'removed_plugin' | 'version_mismatch' | 'ios_code_changed' | 'android_code_changed' | 'both_platforms_changed'

export interface Compatibility {
  name: string
  localVersion?: string
  remoteVersion?: string
  localIosChecksum?: string
  remoteIosChecksum?: string
  localAndroidChecksum?: string
  remoteAndroidChecksum?: string
}

export interface CompatibilityDetails {
  compatible: boolean
  reasons: IncompatibilityReason[]
  message: string
}

export type UploadCompatibilityResult = 'compatible' | 'incompatible' | 'skipped'

export interface UploadCompatibilitySummary {
  result: UploadCompatibilityResult
  incompatibleCount: number
  reasons: IncompatibilityReason[]
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^[~^]/, '')
}

function parseVersion(version: string) {
  const match = normalizeVersion(version).match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match)
    return undefined
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

function versionIntersects(localVersion: string, remoteVersion: string) {
  if (localVersion === remoteVersion)
    return true

  const local = parseVersion(localVersion)
  const remote = parseVersion(remoteVersion)
  if (!local || !remote)
    return false

  if (localVersion.startsWith('^') || remoteVersion.startsWith('^'))
    return local.major === remote.major
  if (localVersion.startsWith('~') || remoteVersion.startsWith('~'))
    return local.major === remote.major && local.minor === remote.minor
  return false
}

export function getCompatibilityDetails(pkg: Compatibility): CompatibilityDetails {
  if (!pkg.localVersion) {
    return {
      compatible: true,
      reasons: [],
      message: 'Package only exists on remote (will be removed)',
    }
  }

  if (!pkg.remoteVersion) {
    return {
      compatible: false,
      reasons: ['new_plugin'],
      message: 'New native plugin added (requires app store update)',
    }
  }

  const reasons: IncompatibilityReason[] = []
  if (!versionIntersects(pkg.localVersion, pkg.remoteVersion))
    reasons.push('version_mismatch')

  const iosChanged = !!pkg.localIosChecksum && !!pkg.remoteIosChecksum && pkg.localIosChecksum !== pkg.remoteIosChecksum
  const androidChanged = !!pkg.localAndroidChecksum && !!pkg.remoteAndroidChecksum && pkg.localAndroidChecksum !== pkg.remoteAndroidChecksum
  if (iosChanged && androidChanged)
    reasons.push('both_platforms_changed')
  else if (iosChanged)
    reasons.push('ios_code_changed')
  else if (androidChanged)
    reasons.push('android_code_changed')

  if (reasons.length === 0)
    return { compatible: true, reasons: [], message: 'Compatible' }

  return {
    compatible: false,
    reasons,
    message: reasons.join(', '),
  }
}

export function isCompatible(pkg: Compatibility) {
  return getCompatibilityDetails(pkg).compatible
}

export function summarizeUploadCompatibility(finalCompatibility: Compatibility[] | undefined): UploadCompatibilitySummary {
  if (!finalCompatibility)
    return { result: 'skipped', incompatibleCount: 0, reasons: [] }

  const incompatible = finalCompatibility.filter(entry => !isCompatible(entry))
  const reasons = [...new Set(incompatible.flatMap(entry => getCompatibilityDetails(entry).reasons))]

  return {
    result: incompatible.length > 0 ? 'incompatible' : 'compatible',
    incompatibleCount: incompatible.length,
    reasons,
  }
}
