import { cloudlogErr, serializeError } from './logging'
import { trackPosthogEvent, type PostHogCapturePayload } from './posthog'

export interface TrackingBentoPayload {
  cron?: string
  data?: Record<string, unknown>
  event: string
  preferenceKey?: string
  uniqId?: string
}

export interface TrackingPayload {
  event: string
  channel: string
  icon?: string
  notify?: boolean
  notifyConsole?: boolean
  user_id?: string
  description?: string
  groups?: Record<string, string>
  tags?: Record<string, unknown>
  bento?: TrackingBentoPayload
  sentToBento?: boolean
}

export interface TrackingContext {
  get?: (key: string) => unknown
  req?: {
    header?: (name: string) => string | undefined
  }
}

export interface TrackingDeps {
  backgroundTask?: (context: unknown, promise: Promise<unknown>) => unknown
  logError?: (message: unknown) => void
  sendNotifToOrgMembers?: (
    context: unknown,
    event: string,
    preferenceKey: string | undefined,
    data: Record<string, unknown> | undefined,
    orgId: string | undefined,
    uniqId: string | undefined,
    cron: string | undefined,
    client?: unknown,
    email?: string,
  ) => Promise<unknown>
  trackLogsnag?: (payload: TrackingPayload) => Promise<unknown>
  trackPosthog?: (context: unknown, payload: PostHogCapturePayload) => Promise<unknown>
}

export interface TrackingOptions {
  background?: boolean
  deps?: TrackingDeps
}

export async function sendEventToTracking(context: unknown, payload: TrackingPayload, options: TrackingOptions = {}): Promise<void> {
  const trackingContext = asTrackingContext(context)
  const deps = options.deps ?? {}
  const background = options.background ?? true
  const tasks: Array<{ provider: string, run: () => Promise<unknown> }> = []

  if (deps.trackLogsnag) {
    tasks.push({
      provider: 'logsnag',
      run: () => deps.trackLogsnag!(payload),
    })
  }

  tasks.push({
    provider: 'posthog',
    run: () => deps.trackPosthog ? deps.trackPosthog(trackingContext, buildPosthogPayload(trackingContext, payload)) : trackPosthogEvent(trackingContext as Parameters<typeof trackPosthogEvent>[0], buildPosthogPayload(trackingContext, payload)),
  })

  if (payload.bento) {
    await (deps.sendNotifToOrgMembers ?? noopNotif)(
      trackingContext,
      payload.bento.event,
      payload.bento.preferenceKey,
      payload.bento.data,
      payload.user_id,
      payload.bento.uniqId,
      payload.bento.cron,
      undefined,
      undefined,
    )
  }

  if (background) {
    for (const task of tasks)
      void (deps.backgroundTask ?? defaultBackgroundTask)(trackingContext, runProvider(task, deps))
    return
  }

  await Promise.all(tasks.map(task => runProvider(task, deps)))
}

function buildPosthogPayload(context: TrackingContext, payload: TrackingPayload): PostHogCapturePayload {
  return {
    channel: payload.channel,
    description: payload.description,
    event: payload.event,
    groups: payload.groups,
    ip: getForwardedIp(context),
    tags: payload.tags,
    user_id: payload.user_id,
  }
}

async function runProvider(task: { provider: string, run: () => Promise<unknown> }, deps: TrackingDeps) {
  try {
    await task.run()
  }
  catch (error) {
    ;(deps.logError ?? cloudlogErr)({
      message: 'sendEventToTracking provider failed',
      provider: task.provider,
      error: serializeError(error),
    })
  }
}

function asTrackingContext(context: unknown): TrackingContext {
  return typeof context === 'object' && context !== null ? context as TrackingContext : {}
}

function getForwardedIp(context: TrackingContext) {
  return context.req?.header?.('x-forwarded-for')?.split(',')[0]?.trim()
}

function defaultBackgroundTask(_context: unknown, promise: Promise<unknown>) {
  return promise
}

async function noopNotif() {
  return false
}
