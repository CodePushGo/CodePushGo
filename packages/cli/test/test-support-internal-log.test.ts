import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { appendInternalLog, getInternalLogPath, safeHeaders, startInternalLog } from '../src/support'

describe('[Capgo parity] support internal log', () => {
  it('starts null and writes redacted lines after start', () => {
    expect(getInternalLogPath()).toBeNull()
    const dir = join(tmpdir(), `codepushgo-log-${Date.now()}`)
    const path = startInternalLog('com.example.app', dir)
    appendInternalLog('Authorization: Bearer SECRETTOKEN123')
    const content = readFileSync(path, 'utf8')
    expect(content).not.toContain('SECRETTOKEN123')
    expect(content).toContain('[REDACTED]')
    rmSync(dir, { recursive: true, force: true })
  })

  it('keeps useful response headers and excludes sensitive ones', () => {
    const out = safeHeaders(new Headers({
      date: 'Mon, 08 Jun 2026 10:37:08 GMT',
      'x-request-id': 'req-abc123',
      'set-cookie': 'session=topsecret',
      authorization: 'Bearer no',
      'www-authenticate': 'Bearer error="invalid_token"',
    }))
    expect(out).toContain('date=Mon, 08 Jun 2026 10:37:08 GMT')
    expect(out).toContain('x-request-id=req-abc123')
    expect(out).toContain('www-authenticate=Bearer error="invalid_token"')
    expect(out).not.toContain('topsecret')
    expect(out).not.toContain('Bearer no')
  })
})
