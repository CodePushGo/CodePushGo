export interface SoftDeletedVersionCleanupCandidate {
  id: string
  name: string
  deleted: boolean
  deletedAt?: string | null
  bundleSize?: number | null
  manifestCount?: number | null
  hasManifestRows?: boolean
}

export interface DeletedVersionCleanupDecision {
  deleteIds: string[]
  keepIds: string[]
}

const retentionMs = 90 * 24 * 60 * 60 * 1000

function parseTime(value: string | null | undefined) {
  if (!value)
    return undefined
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : undefined
}

export function canPermanentlyDeleteSoftDeletedVersion(candidate: SoftDeletedVersionCleanupCandidate, now = new Date()) {
  if (!candidate.deleted)
    return false

  const deletedAt = parseTime(candidate.deletedAt)
  if (deletedAt == null)
    return false

  if (now.getTime() - deletedAt < retentionMs)
    return false

  if ((candidate.bundleSize ?? 0) > 0)
    return false

  if ((candidate.manifestCount ?? 0) > 0)
    return false

  if (candidate.hasManifestRows)
    return false

  return true
}

export function selectOldDeletedVersionsForPermanentDeletion(candidates: SoftDeletedVersionCleanupCandidate[], now = new Date()): DeletedVersionCleanupDecision {
  const deleteIds: string[] = []
  const keepIds: string[] = []

  for (const candidate of candidates) {
    if (canPermanentlyDeleteSoftDeletedVersion(candidate, now))
      deleteIds.push(candidate.id)
    else
      keepIds.push(candidate.id)
  }

  return { deleteIds, keepIds }
}
