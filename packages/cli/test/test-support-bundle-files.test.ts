import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { renderBundleWithinGzCap, writeSupportBundleFiles } from '../src/support'

describe('[Capgo parity] support bundle files', () => {
  it('writes both plain and gzipped logs with identical decoded content', () => {
    const dir = join(tmpdir(), `codepushgo-bundle-${Date.now()}`)
    const result = writeSupportBundleFiles({ kind: 'build-init', appId: 'com.example.app', error: 'boom', logs: ['l1', 'l2'] }, dir)
    expect(existsSync(result.logPath)).toBe(true)
    expect(existsSync(result.gzPath)).toBe(true)
    expect(readFileSync(result.logPath, 'utf8')).toBe(gunzipSync(readFileSync(result.gzPath)).toString('utf8'))
    rmSync(dir, { recursive: true, force: true })
  })

  it('trims oldest build output to fit the gzip cap while keeping the failure tail', () => {
    const lines = Array.from({ length: 5000 }, (_, index) => `build line ${index} ${'x'.repeat(48)}`)
    lines.push('FATAL: real failure at the tail')
    const { rendered, gz } = renderBundleWithinGzCap({
      kind: 'build-init',
      appId: 'com.example.app',
      error: 'boom',
      sections: [{ title: 'Build output (full)', lines }, { title: 'AI analysis', lines: ['keep this'] }],
    }, 6000)

    expect(gz.length).toBeLessThanOrEqual(6000)
    expect(rendered).toContain('FATAL: real failure at the tail')
    expect(rendered).toContain('omitted to fit')
    expect(rendered).toContain('keep this')
    expect(rendered).not.toContain('build line 0 ')
  })
})
