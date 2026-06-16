import { describe, expect, it } from 'vitest'
import { onboardingProgress, updateOnboardingStep } from '../src/onboarding-state'

describe('[Capgo parity] onboarding progress', () => {
  it('tracks completed, skipped, failed, and percent state', () => {
    const steps = [
      { id: 'detect', label: 'Detect app', state: 'done' as const },
      { id: 'bundle', label: 'Bundle JS', state: 'running' as const },
      { id: 'upload', label: 'Upload', state: 'pending' as const },
    ]
    expect(onboardingProgress(steps)).toEqual({ total: 3, completed: 1, failed: 0, percent: 33 })
    expect(onboardingProgress(updateOnboardingStep(steps, 'bundle', 'failed'))).toEqual({ total: 3, completed: 1, failed: 1, percent: 33 })
  })
})
