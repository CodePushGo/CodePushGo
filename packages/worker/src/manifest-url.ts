import { normalizeLegacyEncodedManifestFileName } from './manifest-encoding'

export interface ManifestRow {
  file_name?: string | null
  file_hash?: string | null
  s3_path?: string | null
}

export interface ManifestEntry {
  file_name: string | null
  file_hash?: string | null
  download_url: string
}

export function getManifestUrl(requestUrl: string, versionId: string | number, manifest: ManifestRow[] | null | undefined, deviceId: string) {
  if (!manifest)
    return []

  try {
    const url = new URL(requestUrl)
    return manifest.flatMap((entry): ManifestEntry[] => {
      if (!entry.s3_path)
        return []
      const downloadUrl = new URL(url.toString())
      downloadUrl.pathname = `/read/attachments/${entry.s3_path}`
      downloadUrl.search = new URLSearchParams({ key: String(versionId), device_id: deviceId }).toString()
      return [{
        file_name: normalizeLegacyEncodedManifestFileName(entry.file_name, entry.s3_path),
        file_hash: entry.file_hash,
        download_url: downloadUrl.toString(),
      }]
    })
  }
  catch {
    return []
  }
}
