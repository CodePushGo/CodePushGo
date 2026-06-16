import { describe, expect, it } from 'vitest'
import { buildRunTargets } from '../src/onboarding-state'

describe('[Capgo parity] onboarding run targets', () => {
  it('labels detected run targets by platform without invoking native build tools', () => {
    expect(buildRunTargets('ios', [{ id: 'sim-1', name: 'iPhone' }])).toEqual([{ platform: 'ios', id: 'sim-1', label: 'iPhone (ios)' }])
    expect(buildRunTargets('android', [{ id: 'emu-1', name: 'Pixel' }])).toEqual([{ platform: 'android', id: 'emu-1', label: 'Pixel (android)' }])
  })
})
