export type BuildTransition = 'started' | 'succeeded' | 'failed' | 'timed_out'
import { sendEventToTracking } from './tracking'

export type BuildFailureCategory = 'timeout' | 'builder_error' | 'validation_error' | 'unknown'

const TERMINAL_BUILD_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'expired', 'released'])
const VALIDATION_HINTS = ['invalid build_mode', 'missing credential', 'validation']

interface ClassifyInput {
  previous: string
  next: string
  timeoutApplied: boolean
}

export function buildBuilderPayload(input: {
  orgId: string
  actorUserId: string
  uploadPath: string
  platform: string
  buildOptions: Record<string, unknown>
  buildCredentials: Record<string, string>
}) {
  const buildOptions = { ...input.buildOptions }
  delete buildOptions.timeoutSeconds

  return {
    userId: input.orgId,
    actorUserId: input.actorUserId,
    artifactKey: input.uploadPath,
    fastlane: { lane: input.platform },
    buildOptions,
    buildCredentials: input.buildCredentials,
  }
}

export const builderPayloadTestUtils = { buildBuilderPayload }

export function classifyBuildTransition(input: ClassifyInput): BuildTransition | null {
  if (TERMINAL_BUILD_STATUSES.has(input.previous))
    return null

  if (input.timeoutApplied)
    return 'timed_out'

  if (input.previous === input.next)
    return null

  if (input.next === 'running')
    return 'started'

  if (input.next === 'succeeded')
    return 'succeeded'

  if (input.next === 'failed')
    return 'failed'

  return null
}

interface FailureInput {
  timeoutApplied: boolean
  errorMessage: string | null | undefined
}

export function mapBuildFailureCategory(input: FailureInput): BuildFailureCategory {
  if (input.timeoutApplied)
    return 'timeout'

  const message = (input.errorMessage ?? '').toLowerCase()
  if (!message)
    return 'unknown'

  for (const hint of VALIDATION_HINTS) {
    if (message.includes(hint))
      return 'validation_error'
  }

  return 'builder_error'
}

interface BuildRowForTracking {
  app_id: string
  platform: string
  build_mode: string
  owner_org: string
  requested_by: string
}

export interface EmitBuildTransitionInput {
  previousStatus: string
  effectiveStatus: string
  timeoutApplied: boolean
  effectiveError?: string | null
  effectiveBuildTimeSeconds?: number | null
  build: BuildRowForTracking
}

const EVENT_NAME_BY_TRANSITION: Record<BuildTransition, string> = {
  started: 'Build Started',
  succeeded: 'Build Succeeded',
  failed: 'Build Failed',
  timed_out: 'Build Timed Out',
}

const ICON_BY_TRANSITION: Record<BuildTransition, string> = {
  started: '⏳',
  succeeded: '✅',
  failed: '❌',
  timed_out: '⏰',
}

export async function emitBuildTransitionEvent(context: unknown, input: EmitBuildTransitionInput): Promise<void> {
  const transition = classifyBuildTransition({
    previous: input.previousStatus,
    next: input.effectiveStatus,
    timeoutApplied: input.timeoutApplied,
  })
  if (!transition)
    return

  const tags: Record<string, string> = {
    app_id: input.build.app_id,
    org_id: input.build.owner_org,
    platform: input.build.platform,
    build_mode: input.build.build_mode,
  }

  if (
    input.effectiveBuildTimeSeconds !== null
    && input.effectiveBuildTimeSeconds !== undefined
    && (transition === 'succeeded' || transition === 'failed' || transition === 'timed_out')
  ) {
    tags.duration_seconds = String(input.effectiveBuildTimeSeconds)
  }

  if (transition === 'failed' || transition === 'timed_out') {
    tags.failure_category = mapBuildFailureCategory({
      timeoutApplied: input.timeoutApplied,
      errorMessage: input.effectiveError ?? null,
    })
  }

  try {
    await sendEventToTracking(context, {
      event: EVENT_NAME_BY_TRANSITION[transition],
      channel: 'build-lifecycle',
      icon: ICON_BY_TRANSITION[transition],
      notify: false,
      user_id: input.build.requested_by,
      groups: { organization: input.build.owner_org },
      tags,
    })
  }
  catch {
    // Build telemetry must not break the build flow.
  }
}
