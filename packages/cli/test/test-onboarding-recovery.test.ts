import { describe, expect, it } from 'vitest'
import { recoverableOnboardingStep } from '../src/onboarding-state'

describe('[Capgo parity] onboarding recovery', () => {
  it('resumes failed/running steps before pending work', () => {
    expect(recoverableOnboardingStep([
      { id: 'detect', label: 'Detect app', state: 'done' },
      { id: 'bundle', label: 'Bundle JS', state: 'failed' },
      { id: 'upload', label: 'Upload', state: 'pending' },
    ])?.id).toBe('bundle')
    expect(recoverableOnboardingStep([{ id: 'upload', label: 'Upload', state: 'pending' }])?.id).toBe('upload')
  })
})
