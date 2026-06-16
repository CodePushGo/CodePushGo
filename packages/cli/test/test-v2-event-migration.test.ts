import { describe, expect, it } from 'vitest'
import type { CliEventPayload } from '../src/utils'

describe('[Capgo parity] v2 event migration', () => {
  it('keeps CLI telemetry payloads on tracking_version 2 with string tags', () => {
    const payload: CliEventPayload = { channel: 'builder-onboarding', event: 'Builder Onboarding Step', tracking_version: 2, tags: { step: 'upload', app_id: 'com.example.app' } }
    expect(payload.tracking_version).toBe(2)
    expect(Object.values(payload.tags ?? {}).every(value => typeof value === 'string')).toBe(true)
  })
})
