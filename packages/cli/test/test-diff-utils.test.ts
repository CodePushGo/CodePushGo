import { describe, expect, it } from 'vitest'
import { diffLines } from '../src/diff-utils'

describe('[Capgo parity] diff utils', () => {
  it('marks new and removed files', () => {
    expect(diffLines('', 'name: CodePushGo\non: workflow_dispatch')).toEqual([
      { kind: 'add', text: 'name: CodePushGo' },
      { kind: 'add', text: 'on: workflow_dispatch' },
    ])
    expect(diffLines('foo\nbar', '')).toEqual([{ kind: 'del', text: 'foo' }, { kind: 'del', text: 'bar' }])
  })

  it('preserves context around replacements and insertions', () => {
    expect(diffLines('hello\nworld', 'hello\nthere')).toEqual([
      { kind: 'eq', text: 'hello' },
      { kind: 'del', text: 'world' },
      { kind: 'add', text: 'there' },
    ])
    expect(diffLines('a\nb\nc', 'a\nNEW\nb\nc')).toEqual([
      { kind: 'eq', text: 'a' },
      { kind: 'add', text: 'NEW' },
      { kind: 'eq', text: 'b' },
      { kind: 'eq', text: 'c' },
    ])
  })
})
