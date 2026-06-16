import { describe, expect, it } from 'vitest'
import { resolvePlatform } from '../src/platform'
import { platformKeyAction, pickPlatformLayout } from '../src/terminal-layout'

describe('[Capgo parity] platform flow contract', () => {
  it('keeps platform routing explicit and keyboard selectable', () => {
    expect(resolvePlatform('ios')).toBe('ios')
    expect(resolvePlatform('android')).toBe('android')
    expect(() => resolvePlatform('web')).toThrow(/platform/)
    expect(pickPlatformLayout(80, 24)).toBe('cards')
    expect(pickPlatformLayout(40, 24)).toBe('list')
    expect(platformKeyAction('1', {})).toEqual({ type: 'select', platform: 'ios' })
    expect(platformKeyAction('2', {})).toEqual({ type: 'select', platform: 'android' })
    expect(platformKeyAction('', { return: true })).toEqual({ type: 'confirm' })
  })
})
