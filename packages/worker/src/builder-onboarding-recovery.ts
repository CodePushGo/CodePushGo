export const BUILDER_RECOVERY_MILESTONES = new Set(['welcome', 'build-complete'])

export interface BuilderOnboardingRecoveryInput {
  event: string
  step?: string
  orgId?: string
  appId?: string
  platform?: string
  orgName?: string
  appName?: string
}

export interface BuilderOnboardingBentoEvent {
  event: 'builder_onboarding_started' | 'builder_onboarding_completed'
  preferenceKey: 'builder_onboarding'
  cron: string
  uniqId: string
  data: {
    org_id: string
    org_name?: string
    app_id: string
    app_name?: string
    platform: string
    step: string
  }
}

export function buildBuilderOnboardingBentoEvent(input: BuilderOnboardingRecoveryInput): BuilderOnboardingBentoEvent | undefined {
  if (input.event !== 'Builder Onboarding Step')
    return undefined
  if (!input.step || !BUILDER_RECOVERY_MILESTONES.has(input.step))
    return undefined
  if (!input.orgId || !input.appId)
    return undefined

  const completed = input.step === 'build-complete'
  const event = completed ? 'builder_onboarding_completed' : 'builder_onboarding_started'
  const platform = input.platform ?? 'unknown'
  return {
    event,
    preferenceKey: 'builder_onboarding',
    cron: '* * * * *',
    uniqId: `${event}:${input.appId}:${platform}`,
    data: {
      org_id: input.orgId,
      org_name: input.orgName,
      app_id: input.appId,
      app_name: input.appName,
      platform,
      step: input.step,
    },
  }
}
