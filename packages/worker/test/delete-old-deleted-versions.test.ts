import { describe, expect, it } from 'vitest'
import { selectOldDeletedVersionsForPermanentDeletion } from '../src/deleted-versions-cleanup'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

describe('[Capgo parity] delete_old_deleted_versions', () => {
  it.concurrent('permanently deletes only versions soft-deleted for at least 90 days', () => {
    const now = new Date('2026-06-15T00:00:00.000Z')
    const result = selectOldDeletedVersionsForPermanentDeletion([
      { id: 'stale', name: 'stale', deleted: true, deletedAt: '2026-03-16T23:59:58.000Z' },
      { id: 'fresh', name: 'fresh', deleted: true, deletedAt: '2026-03-18T00:00:00.000Z' },
      { id: 'active', name: 'active', deleted: false, deletedAt: '2026-02-15T00:00:00.000Z' },
    ], now)

    expect(result.deleteIds).toEqual(['stale'])
    expect(result.keepIds.sort()).toEqual(['active', 'fresh'].sort())
  })

  it.concurrent('keeps stale deleted versions until bundle and manifest cleanup is complete', () => {
    const now = new Date('2026-06-15T00:00:00.000Z')
    const result = selectOldDeletedVersionsForPermanentDeletion([
      { id: 'clean', name: 'clean', deleted: true, deletedAt: '2026-03-15T00:00:00.000Z', bundleSize: 0, manifestCount: 0, hasManifestRows: false },
      { id: 'manifest-pending', name: 'manifest-pending', deleted: true, deletedAt: '2026-03-15T00:00:00.000Z', bundleSize: 0, manifestCount: 1, hasManifestRows: true },
      { id: 'bundle-pending', name: 'bundle-pending', deleted: true, deletedAt: '2026-03-15T00:00:00.000Z', bundleSize: 64, manifestCount: 0, hasManifestRows: false },
      { id: 'manifest-signal-pending', name: 'manifest-signal-pending', deleted: true, deletedAt: '2026-03-15T00:00:00.000Z', bundleSize: 0, manifestCount: 1, hasManifestRows: false },
    ], now)

    expect(result.deleteIds).toEqual(['clean'])
    expect(result.keepIds.sort()).toEqual(['bundle-pending', 'manifest-pending', 'manifest-signal-pending'].sort())
  })

  it.concurrent('keeps the deleted-version cleanup cron task enabled daily', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.delete_old_deleted_versions()')
    expect(migrationSql).toContain("'delete_old_versions'")
    expect(migrationSql).toContain('Permanently delete app versions 90 days after soft delete')
    expect(migrationSql).toContain("'public.delete_old_deleted_versions()'")
    expect(migrationSql).toContain('enabled = true')
  })
})
