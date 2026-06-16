export interface DeletedVersionRecord {
  appId: string
  id: number | string
  manifestFiles?: Array<{ id: number | string, s3Path: string, referenced?: boolean }>
  r2Path?: string | null
  size?: number | null
}

export interface VersionCleanupDeps {
  moveObjectToTrash(path: string): Promise<boolean>
  clearVersionSize(versionId: number | string): Promise<void>
  createStatsMeta(appId: string, versionId: number | string, sizeDelta: number): Promise<void>
  deleteManifestRows(versionId: number | string): Promise<void>
  updateManifestCount(versionId: number | string, count: number): Promise<void>
}

export async function cleanupDeletedVersion(version: DeletedVersionRecord, deps: VersionCleanupDeps) {
  if (version.r2Path) {
    const moved = await deps.moveObjectToTrash(version.r2Path)
    if (!moved)
      throw new Error('Cannot move S3 object for deleted version to trash')
  }

  for (const file of version.manifestFiles ?? []) {
    if (file.referenced)
      continue
    const moved = await deps.moveObjectToTrash(file.s3Path)
    if (!moved)
      throw new Error('Cannot move manifest object for deleted version to trash')
  }

  await deps.deleteManifestRows(version.id)
  await deps.updateManifestCount(version.id, 0)
  await deps.clearVersionSize(version.id)
  const size = version.size ?? 0
  if (size > 0)
    await deps.createStatsMeta(version.appId, version.id, -size)

  return { status: 'ok' as const }
}
