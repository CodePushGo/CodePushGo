import { sendEvent } from '../../utils'
import { mapAndroidOnboardingError, mapIosOnboardingError, type AndroidOnboardingErrorCategory, type OnboardingErrorCategory } from './error-categories'

export type BuilderOnboardingPlatform = 'ios' | 'android'

export interface TrackBuilderOnboardingStepInput {
  apikey: string
  appId: string
  orgId: string
  platform: BuilderOnboardingPlatform
  step: string
  durationMs?: number
  durationStep?: string
  error?: unknown
  errorCategory?: OnboardingErrorCategory | AndroidOnboardingErrorCategory
}

export async function trackBuilderOnboardingStep(input: TrackBuilderOnboardingStepInput): Promise<void> {
  const tags: Record<string, string> = {
    step: input.step,
    platform: input.platform,
    app_id: input.appId,
  }

  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)) {
    tags.duration_ms = String(Math.round(input.durationMs))
    if (input.durationStep)
      tags.duration_step = input.durationStep
  }

  if (input.errorCategory !== undefined) {
    tags.error_category = input.errorCategory
  }
  else if (input.error !== undefined) {
    tags.error_category = input.platform === 'ios'
      ? mapIosOnboardingError(input.error)
      : mapAndroidOnboardingError(input.error)
  }

  try {
    await sendEvent(input.apikey, {
      event: 'Builder Onboarding Step',
      channel: 'builder-onboarding',
      icon: '🧭',
      notify: false,
      org_id: input.orgId,
      tracking_version: 2,
      tags,
    })
  }
  catch {
    // Telemetry must not break onboarding flows.
  }
}
