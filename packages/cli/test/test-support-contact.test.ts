import { describe, expect, it } from 'vitest'
import { buildSupportMailto } from '../src/support'

describe('[Capgo parity] support contact mailto', () => {
  it('targets CodePushGo support with uploaded log link when available', () => {
    const mailto = buildSupportMailto({ subject: 'Need help', body: 'failure', uploadUrl: 'https://api.test/logs/abc' })
    expect(mailto).toMatch(/^mailto:support@codepushgo\.com\?/) 
    expect(decodeURIComponent(mailto)).toContain('https://api.test/logs/abc')
  })

  it('falls back to attach path instructions', () => {
    expect(decodeURIComponent(buildSupportMailto({ subject: 'Need help', body: 'failure', attachmentPath: '/tmp/log.gz' }))).toContain('Please attach: /tmp/log.gz')
  })
})
