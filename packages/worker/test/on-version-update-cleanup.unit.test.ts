import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupDeletedVersion, type VersionCleanupDeps } from '../src/on-version-update-cleanup'

function createDeps(): VersionCleanupDeps & Record<string, ReturnType<typeof vi.fn>> {
  return {
    moveObjectToTrash: vi.fn().mockResolvedValue(true),
    clearVersionSize: vi.fn().mockResolvedValue(undefined),
    createStatsMeta: vi.fn().mockResolvedValue(undefined),
    deleteManifestRows: vi.fn().mockResolvedValue(undefined),
    updateManifestCount: vi.fn().mockResolvedValue(undefined),
  } as VersionCleanupDeps & Record<string, ReturnType<typeof vi.fn>>
}

describe('[Capgo parity] on_version_update deleted version cleanup', () => {
  let deps: VersionCleanupDeps & Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    deps = createDeps()
  })

  it('moves the bundle to trash and clears stored size for soft-deleted versions', async () => {
    await expect(cleanupDeletedVersion({ appId: 'com.cleanup.test', id: 123, r2Path: 'orgs/org-1/apps/com.cleanup.test/1.0.0.zip', size: 1234 }, deps)).resolves.toEqual({ status: 'ok' })

    expect(deps.moveObjectToTrash).toHaveBeenCalledWith('orgs/org-1/apps/com.cleanup.test/1.0.0.zip')
    expect(deps.clearVersionSize).toHaveBeenCalledWith(123)
    expect(deps.createStatsMeta).toHaveBeenCalledWith('com.cleanup.test', 123, -1234)
  })

  it('still clears stale metadata when the deleted version has no bundle path', async () => {
    await cleanupDeletedVersion({ appId: 'com.cleanup.test', id: 123, r2Path: null, size: 1234 }, deps)

    expect(deps.moveObjectToTrash).not.toHaveBeenCalled()
    expect(deps.clearVersionSize).toHaveBeenCalledWith(123)
    expect(deps.createStatsMeta).toHaveBeenCalledWith('com.cleanup.test', 123, -1234)
  })

  it('moves unreferenced manifest files to trash instead of hard deleting them', async () => {
    await cleanupDeletedVersion({
      appId: 'com.cleanup.test',
      id: 123,
      r2Path: null,
      manifestFiles: [{ id: 456, s3Path: 'orgs/org-1/apps/com.cleanup.test/manifest/index.js' }],
    }, deps)

    expect(deps.moveObjectToTrash).toHaveBeenCalledWith('orgs/org-1/apps/com.cleanup.test/manifest/index.js')
    expect(deps.deleteManifestRows).toHaveBeenCalledWith(123)
    expect(deps.updateManifestCount).toHaveBeenCalledWith(123, 0)
  })

  it('keeps the queue retryable when moving the bundle to trash fails', async () => {
    deps.moveObjectToTrash.mockResolvedValue(false)

    await expect(cleanupDeletedVersion({ appId: 'com.cleanup.test', id: 123, r2Path: 'orgs/org-1/apps/com.cleanup.test/1.0.0.zip', size: 1234 }, deps)).rejects.toThrow('Cannot move S3 object for deleted version to trash')
    expect(deps.clearVersionSize).not.toHaveBeenCalled()
    expect(deps.createStatsMeta).not.toHaveBeenCalled()
  })
})
