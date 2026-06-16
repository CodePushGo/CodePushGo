import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { zipSync } from 'fflate'
const skippedPathSegments = new Set(['__MACOSX', '.git'])
const skippedFileNames = new Set(['.DS_Store', 'Thumbs.db'])

export function shouldIncludeBundleFile(relativePath: string) {
  const normalized = relativePath.split(sep).join('/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some(part => skippedPathSegments.has(part)))
    return false
  return !skippedFileNames.has(parts.at(-1) ?? '')
}

export async function zipDirectory(directory: string): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  await collectFiles(directory, directory, files)

  if (Object.keys(files).length === 0)
    throw new Error(`No files found in ${directory}`)

  return zipSync(files, { level: 9 })
}

export function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function collectFiles(root: string, current: string, files: Record<string, Uint8Array>) {
  const currentStat = await stat(current)
  if (currentStat.isFile()) {
    const name = relative(root, current).split(sep).join('/')
    if (!shouldIncludeBundleFile(name))
      return
    files[name] = new Uint8Array(await readFile(current))
    return
  }

  const entries = await readdir(current, { withFileTypes: true })
  for (const entry of entries)
    await collectFiles(root, join(current, entry.name), files)
}
