import { describe, expect, it } from 'vitest'
import { pickPlatformLayout, platformKeyAction, PLATFORM_CARDS_MIN_COLS, PLATFORM_CARDS_MIN_ROWS } from '../src/terminal-layout'

describe('[Capgo parity] platform layout decisions', () => {
  it('uses cards only when terminal is wide and tall enough', () => {
    expect(pickPlatformLayout(80, 24)).toBe('cards')
    expect(pickPlatformLayout(PLATFORM_CARDS_MIN_COLS, PLATFORM_CARDS_MIN_ROWS)).toBe('cards')
    expect(pickPlatformLayout(PLATFORM_CARDS_MIN_COLS - 1, 40)).toBe('list')
    expect(pickPlatformLayout(120, PLATFORM_CARDS_MIN_ROWS - 1)).toBe('list')
  })

  it('maps platform picker keys', () => {
    expect(platformKeyAction('', { leftArrow: true })).toEqual({ type: 'select', platform: 'ios' })
    expect(platformKeyAction('1', {})).toEqual({ type: 'select', platform: 'ios' })
    expect(platformKeyAction('', { rightArrow: true })).toEqual({ type: 'select', platform: 'android' })
    expect(platformKeyAction('2', {})).toEqual({ type: 'select', platform: 'android' })
    expect(platformKeyAction('', { return: true, leftArrow: true })).toEqual({ type: 'confirm' })
    expect(platformKeyAction('x', {})).toBeNull()
  })
})
