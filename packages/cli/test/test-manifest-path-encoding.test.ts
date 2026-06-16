import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildPartialUploadPath } from '../src/partial'

describe('[Capgo parity] manifest path encoding', () => {
  it('keeps partial upload object keys URL-safe without flattening folders', () => {
    const fileName = 'assets/suite-marketing/images/social-media/sad_post_grey@2x.png'
    const fileHash = 'file-hash'
    const expectedHash = createHash('sha256').update(fileHash).digest('hex')
    const storagePath = buildPartialUploadPath('org-id', 'com.test.app', fileHash, fileName)

    expect(storagePath).toBe(`orgs/org-id/apps/com.test.app/delta/${expectedHash}_assets/suite-marketing/images/social-media/sad_post_grey%402x.png`)
    expect(storagePath).not.toContain('sad_post_grey@2x.png')
  })
})
