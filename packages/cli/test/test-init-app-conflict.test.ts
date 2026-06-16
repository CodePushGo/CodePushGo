import { describe, expect, it } from 'vitest'
import { buildAppIdConflictSuggestions, isAppAlreadyExistsError } from '../src/init-conflict'

describe('[Capgo parity] init app conflict handling', () => {
  it('detects duplicate app errors', () => {
    expect(isAppAlreadyExistsError(new Error('App com.example.app already exists'))).toBe(true)
    expect(isAppAlreadyExistsError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(true)
    expect(isAppAlreadyExistsError(new Error('network unavailable'))).toBe(false)
  })

  it('suggests app ids from the current RN bundle id', () => {
    expect(buildAppIdConflictSuggestions('com.example.current', () => 0.5, () => 123456789).slice(1)).toEqual([
      'com.example.current.dev',
      'com.example.current.app',
      'com.example.current-6789',
      'com.example.current2',
      'com.example.current3',
    ])
  })
})
