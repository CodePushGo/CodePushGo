import { sendEvent } from '../utils'
export type InvocationSource = 'cli' | 'mcp'
export type AppCreateSource = 'cli-direct' | 'mcp' | 'onboarding'

let invocationSource: InvocationSource = 'cli'

export function setInvocationSource(source: InvocationSource) {
  invocationSource = source
}

export function getInvocationSource() {
  return invocationSource
}

export function resolveAppCreateSource(explicitSource?: AppCreateSource) {
  if (explicitSource)
    return explicitSource
  return invocationSource === 'mcp' ? 'mcp' : 'cli-direct'
}

export interface TrackEventInput {
  apikey: string
  event: string
  channel: string
  icon?: string
  notify?: boolean
  orgId?: string
  tags?: Record<string, string>
}

export async function trackEvent(input: TrackEventInput) {
  try {
    await sendEvent(input.apikey, {
      event: input.event,
      channel: input.channel,
      icon: input.icon,
      notify: input.notify ?? false,
      org_id: input.orgId,
      tracking_version: 2,
      tags: input.tags,
    })
  }
  catch {
    // Analytics must never block CLI flows.
  }
}
