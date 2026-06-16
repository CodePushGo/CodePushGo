import type { Platform } from '@codepushgo/shared'
import { sendEvent } from '../utils'

export type AiAnalysisChoice = 'auto_upload' | 'capgo_ai' | 'local_ai' | 'skip'
export type AiAnalysisChoiceTriggeredBy = 'ci_flag' | 'menu'
export type AiAnalysisResult = 'already_analyzed' | 'error' | 'success' | 'too_big'

interface AiAnalysisTelemetryBase {
  apikey: string
  orgId: string
  appId: string
  platform: Platform
  jobId: string
}

export interface TrackAiAnalysisChoiceInput extends AiAnalysisTelemetryBase {
  choice: AiAnalysisChoice
  triggeredBy: AiAnalysisChoiceTriggeredBy
}

export interface TrackAiAnalysisResultInput extends AiAnalysisTelemetryBase {
  result: AiAnalysisResult
  errorStatus?: number
}

async function sendAiTelemetry(input: AiAnalysisTelemetryBase, event: string, tags: Record<string, string>) {
  try {
    await sendEvent(input.apikey, {
      event,
      channel: 'build-lifecycle',
      icon: '🤖',
      notify: false,
      org_id: input.orgId,
      tracking_version: 2,
      tags: {
        app_id: input.appId,
        platform: input.platform,
        job_id: input.jobId,
        ...tags,
      },
    })
  }
  catch {
    // Telemetry must never break build or onboarding flows.
  }
}

export async function trackAiAnalysisChoice(input: TrackAiAnalysisChoiceInput) {
  await sendAiTelemetry(input, 'CLI AI Build Analysis Choice', {
    choice: input.choice,
    triggered_by: input.triggeredBy,
  })
}

export async function trackAiAnalysisResult(input: TrackAiAnalysisResultInput) {
  const tags: Record<string, string> = { result: input.result }
  if (input.result === 'error' && input.errorStatus !== undefined)
    tags.error_status = String(input.errorStatus)
  await sendAiTelemetry(input, 'CLI AI Build Analysis Result', tags)
}
