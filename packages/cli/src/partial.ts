import { createHash } from 'node:crypto'

export function buildPartialUploadPath(orgId: string, appId: string, fileHash: string, fileName: string) {
  const hashed = createHash('sha256').update(fileHash).digest('hex')
  const encodedPath = fileName.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `orgs/${orgId}/apps/${appId}/delta/${hashed}_${encodedPath}`
}
