import { describe, expect, it } from 'vitest'
import { buildMailtoUrl, MAILTO_BODY_MAX } from '../src/support'

describe('[Capgo parity] support mailto builder', () => {
  it('encodes subject and body', () => {
    const url = buildMailtoUrl({ to: 'support@codepushgo.com', subject: 'A & B', body: 'line1\nline2' })
    expect(url).toContain('subject=A%20%26%20B')
    expect(url).toContain('body=line1%0Aline2')
  })

  it('caps long bodies with a truncation marker', () => {
    const body = decodeURIComponent(buildMailtoUrl({ to: 'support@codepushgo.com', subject: 's', body: 'x'.repeat(MAILTO_BODY_MAX + 100) }).split('body=')[1]!)
    expect(body.length).toBeLessThanOrEqual(MAILTO_BODY_MAX)
    expect(body).toContain('truncated')
  })
})
