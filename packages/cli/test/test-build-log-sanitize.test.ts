import { describe, expect, it } from 'vitest'
import { sanitizeBuildLogLines } from '../src/build/log'

const ESC = '\x1B'

describe('[Capgo parity] build log sanitizer', () => {
  it('splits bare carriage-return redraws into separate lines', () => {
    const zip = '  adding: Foo.dSYM/Contents/Resources/DWARF/Foo (stored 0%)'
    expect(sanitizeBuildLogLines(`${zip}\rCruising`)).toEqual([zip, 'Cruising'])
  })

  it('strips ANSI and C0 controls while expanding tabs to terminal stops', () => {
    expect(sanitizeBuildLogLines(`${ESC}[36mcolored${ESC}[0m`)).toEqual(['colored'])
    expect(sanitizeBuildLogLines(`text${ESC}[K`)).toEqual(['text'])
    expect(sanitizeBuildLogLines('a\x07bc')).toEqual(['abc'])
    expect(sanitizeBuildLogLines('\t* App')).toEqual(['        * App'])
    expect(sanitizeBuildLogLines('ab\tc')).toEqual(['ab      c'])
  })

  it('normalizes line endings without dropping interior blanks', () => {
    expect(sanitizeBuildLogLines('a\r\nb')).toEqual(['a', 'b'])
    expect(sanitizeBuildLogLines('x\n')).toEqual(['x'])
    expect(sanitizeBuildLogLines('a\n\nb')).toEqual(['a', '', 'b'])
  })
})
