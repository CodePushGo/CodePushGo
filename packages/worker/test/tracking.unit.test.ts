import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEventToTracking, type TrackingContext, type TrackingDeps } from '../src/tracking'

function createContext(): TrackingContext {
  return {
    get: (key: string) => key === 'requestId' ? 'request-id' : undefined,
    req: {
      header: (name: string) => name === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : undefined,
    },
  }
}

function createDeps(): Required<Pick<TrackingDeps, 'backgroundTask' | 'logError' | 'sendNotifToOrgMembers' | 'trackLogsnag' | 'trackPosthog'>> {
  return {
    backgroundTask: vi.fn((_context: TrackingContext, promise: Promise<unknown>) => promise),
    logError: vi.fn(),
    sendNotifToOrgMembers: vi.fn().mockResolvedValue(true),
    trackLogsnag: vi.fn().mockResolvedValue(true),
    trackPosthog: vi.fn().mockResolvedValue(true),
  }
}

let deps: ReturnType<typeof createDeps>

beforeEach(() => {
  deps = createDeps()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('[Capgo parity] sendEventToTracking', () => {
  it('runs all tracking providers in the background by default', async () => {
    await sendEventToTracking(createContext(), {
      bento: {
        cron: '* * * * *',
        data: { org_id: 'org-id' },
        event: 'org:tracked',
        preferenceKey: 'onboarding',
        uniqId: 'org:tracked',
      },
      channel: 'usage',
      event: 'Tracked Event',
      user_id: 'org-id',
      description: 'test description',
      notify: false,
      sentToBento: true,
      tags: { app_id: 'app-id' },
    }, { deps })

    expect(deps.backgroundTask).toHaveBeenCalledTimes(2)
    expect(deps.trackLogsnag).toHaveBeenCalledWith(expect.objectContaining({ event: 'Tracked Event' }))
    expect(deps.trackPosthog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      event: 'Tracked Event',
      ip: '1.2.3.4',
      user_id: 'org-id',
    }))
    expect(deps.sendNotifToOrgMembers).toHaveBeenCalledWith(
      expect.anything(),
      'org:tracked',
      'onboarding',
      { org_id: 'org-id' },
      'org-id',
      'org:tracked',
      '* * * * *',
      undefined,
      undefined,
    )
  })

  it('can run inline and keeps other providers running when one fails', async () => {
    deps.trackLogsnag.mockRejectedValueOnce(new Error('logsnag failed'))

    await sendEventToTracking(createContext(), {
      channel: 'usage',
      event: 'Inline Event',
      user_id: 'org-id',
      notify: true,
    }, {
      background: false,
      deps,
    })

    expect(deps.backgroundTask).not.toHaveBeenCalled()
    expect(deps.trackPosthog).toHaveBeenCalledOnce()
    expect(deps.logError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'sendEventToTracking provider failed',
      provider: 'logsnag',
    }))
  })
})
