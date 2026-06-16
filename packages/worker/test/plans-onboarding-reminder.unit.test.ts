import type { Context } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { handleOrgNotificationsAndEvents } from '../src/plans'

function createContext() {
  return {
    get: (key: string) => key === 'requestId' ? 'request-id' : undefined,
  } as Context
}

function createDeps(options: { onboarded?: boolean, onboardingNeeded?: boolean } = {}) {
  return {
    isOnboardedOrg: vi.fn(async () => options.onboarded ?? true),
    isOnboardingNeeded: vi.fn(async () => options.onboardingNeeded ?? false),
    sendNotifToOrgMembers: vi.fn(async () => true),
    sendNotifToOrgMembersOnce: vi.fn(async () => true),
    sendEventToTracking: vi.fn(async () => undefined),
  }
}

function trackingCalls(deps: ReturnType<typeof createDeps>, orgId: string) {
  return deps.sendEventToTracking.mock.calls.filter(([, event]) => (event as { user_id?: string }).user_id === orgId)
}

describe('[Capgo parity] handleOrgNotificationsAndEvents onboarding reminder', () => {
  it.concurrent('sends the trial-expired onboarding reminder only through the one-time helper with org context', async () => {
    const deps = createDeps({ onboarded: false, onboardingNeeded: true })
    const orgId = 'org-onboarding-reminder'

    const result = await handleOrgNotificationsAndEvents(
      createContext(),
      {
        customer_id: null,
        name: 'Acme Mobile',
        stripe_info: null,
        website: 'https://acme.example/',
      },
      orgId,
      false,
      {
        total_percent: 0,
        mau_percent: 0,
        bandwidth_percent: 0,
        storage_percent: 0,
        build_time_percent: 0,
      },
      {},
      deps,
    )

    expect(result).toBe(false)
    expect(deps.sendNotifToOrgMembers).not.toHaveBeenCalled()
    expect(deps.sendNotifToOrgMembersOnce).toHaveBeenCalledWith(
      expect.anything(),
      'user:need_onboarding',
      'onboarding',
      {
        org_id: orgId,
        org_name: 'Acme Mobile',
        org_website: 'https://acme.example/',
      },
      orgId,
      orgId,
      expect.anything(),
    )
    expect(deps.sendEventToTracking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        channel: 'usage',
        event: 'User need onboarding',
        user_id: orgId,
      }),
    )
  })

  it.concurrent('does not send plan usage alerts from stale total percent alone', async () => {
    const deps = createDeps({ onboarded: true })
    const orgId = 'org-usage-stale'

    const result = await handleOrgNotificationsAndEvents(
      createContext(),
      {
        customer_id: 'cus_123',
        name: 'Acme Mobile',
        stripe_info: null,
        website: 'https://acme.example/',
      },
      orgId,
      true,
      {
        total_percent: 51,
        mau_percent: 20,
        bandwidth_percent: 0,
        storage_percent: 0,
        build_time_percent: 0,
      },
      {},
      deps,
    )

    expect(result).toBe(true)
    expect(deps.sendNotifToOrgMembers).not.toHaveBeenCalled()
    expect(trackingCalls(deps, orgId)).toHaveLength(0)
  })

  it.concurrent('sends plan usage alerts with the metric that crossed the threshold', async () => {
    const deps = createDeps({ onboarded: true })
    const orgId = 'org-usage-storage'

    const result = await handleOrgNotificationsAndEvents(
      createContext(),
      {
        customer_id: 'cus_123',
        name: 'Acme Mobile',
        stripe_info: null,
        website: 'https://acme.example/',
      },
      orgId,
      true,
      {
        total_percent: 20,
        mau_percent: 20,
        bandwidth_percent: 0,
        storage_percent: 51,
        build_time_percent: 0,
      },
      {},
      deps,
    )

    expect(result).toBe(true)
    expect(deps.sendNotifToOrgMembers).toHaveBeenCalledWith(
      expect.anything(),
      'user:usage_50_percent_of_plan',
      'usage_limit',
      {
        metric: 'storage',
        metric_percent: 51,
        percent: {
          total_percent: 51,
          mau_percent: 20,
          bandwidth_percent: 0,
          storage_percent: 51,
          build_time_percent: 0,
        },
        threshold: 50,
      },
      orgId,
      orgId,
      '0 0 1 * *',
      expect.anything(),
    )
    expect(deps.sendEventToTracking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        channel: 'usage',
        event: 'User is at 50% of plan usage',
        user_id: orgId,
        tags: {
          metric: 'storage',
          metric_percent: '51',
          threshold: '50',
        },
      }),
    )
  })
})
