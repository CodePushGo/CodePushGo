import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  normalizeAutoUpdateMode,
  normalizePeriodCheckDelay,
  normalizeUpdateResponseKind,
} from '../src/native-contract'

interface ContractCase<TInput, TExpect> {
  id: string
  input: TInput
  expect: TExpect
}

interface NativeContract {
  version: number
  periodCheckDelay: Array<ContractCase<{ seconds: number }, { normalizedSeconds: number }>>
  autoUpdateMode: Array<ContractCase<{ mode: string }, ReturnType<typeof normalizeAutoUpdateMode>>>
  updateResponseKind: Array<ContractCase<{ kind: string | null }, { kind: string }>>
}

const fixture = JSON.parse(readFileSync(new URL('../../../native-contract-tests/core.json', import.meta.url), 'utf8')) as NativeContract

describe('React Native updater native contract', () => {
  it('uses the current simplified RN contract version', () => {
    expect(fixture.version).toBe(2)
  })

  for (const testCase of fixture.periodCheckDelay) {
    it(`normalizes period delay: ${testCase.id}`, () => {
      expect(normalizePeriodCheckDelay(testCase.input.seconds)).toBe(testCase.expect.normalizedSeconds)
    })
  }

  for (const testCase of fixture.autoUpdateMode) {
    it(`normalizes auto update mode: ${testCase.id}`, () => {
      expect(normalizeAutoUpdateMode(testCase.input.mode)).toEqual(testCase.expect)
    })
  }

  for (const testCase of fixture.updateResponseKind) {
    it(`normalizes update response kind: ${testCase.id}`, () => {
      expect(normalizeUpdateResponseKind(testCase.input.kind)).toBe(testCase.expect.kind)
    })
  }
})
