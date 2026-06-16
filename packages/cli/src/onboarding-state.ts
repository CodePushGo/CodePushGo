export type OnboardingStepState = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface OnboardingStep {
  id: string
  label: string
  state: OnboardingStepState
}

export function updateOnboardingStep(steps: OnboardingStep[], id: string, state: OnboardingStepState) {
  return steps.map(step => step.id === id ? { ...step, state } : step)
}

export function onboardingProgress(steps: OnboardingStep[]) {
  const total = steps.length
  const completed = steps.filter(step => step.state === 'done' || step.state === 'skipped').length
  const failed = steps.filter(step => step.state === 'failed').length
  return { total, completed, failed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) }
}

export function recoverableOnboardingStep(steps: OnboardingStep[]) {
  return steps.find(step => step.state === 'failed' || step.state === 'running') ?? steps.find(step => step.state === 'pending')
}

export function buildRunTargets(platform: 'ios' | 'android', devices: Array<{ id: string, name: string }>) {
  return devices.map(device => ({ platform, id: device.id, label: `${device.name} (${platform})` }))
}
