import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotifToOrgMembersOnce, type OrgNotificationClaimStore } from '../src/notifications'

function createContext() {
  return {
    get: (key: string) => key === 'requestId' ? 'request-id' : undefined,
  }
}

function createStore(options?: { existingClaims?: string[], orgLookupError?: boolean, orgClaimed?: boolean, deleteError?: Error }): OrgNotificationClaimStore & {
  claim: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  has: ReturnType<typeof vi.fn>
} {
  const claims = new Set(options?.existingClaims ?? [])
  return {
    claim: vi.fn(async (eventName: string, orgId: string, uniqId: string) => {
      const key = `${eventName}:${orgId}:${uniqId}`
      if (options?.orgClaimed && !uniqId.includes(':'))
        return false
      if (claims.has(key))
        return false
      claims.add(key)
      return true
    }),
    delete: options?.deleteError
      ? vi.fn().mockRejectedValue(options.deleteError)
      : vi.fn(async (eventName: string, orgId: string, uniqId: string) => {
          claims.delete(`${eventName}:${orgId}:${uniqId}`)
        }),
    has: vi.fn(async (eventName: string, orgId: string, uniqId: string) => {
      if (options?.orgLookupError && !uniqId.includes(':'))
        return null
      return claims.has(`${eventName}:${orgId}:${uniqId}`)
    }),
  }
}

describe('[Capgo parity] sendNotifToOrgMembersOnce', () => {
  const trackEvent = vi.fn()
  const logError = vi.fn()
  const log = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    trackEvent.mockResolvedValue(true)
  })

  it('does not send recipient notifications when the org-level claim already exists', async () => {
    const store = createStore({ existingClaims: ['user:need_onboarding:org-123:org-123'] })

    const sent = await sendNotifToOrgMembersOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123',
      ['billing@example.com'],
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toBe(false)
    expect(trackEvent).not.toHaveBeenCalled()
    expect(store.claim).not.toHaveBeenCalled()
  })

  it('fails closed when the org-level claim lookup errors', async () => {
    const store = createStore({ orgLookupError: true })

    const sent = await sendNotifToOrgMembersOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123',
      ['billing@example.com'],
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toBe(false)
    expect(trackEvent).not.toHaveBeenCalled()
    expect(store.claim).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      message: 'sendNotifToOrgMembersOnce: org claim lookup failed',
      orgId: 'org-123',
      uniqId: 'org-123',
    }))
  })

  it('backfills the org-level claim once all recipient claims already exist', async () => {
    const store = createStore({ existingClaims: [
      'user:need_onboarding:org-123:org-123:billing@example.com',
      'user:need_onboarding:org-123:org-123:admin@example.com',
    ] })

    const sent = await sendNotifToOrgMembersOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123',
      ['billing@example.com', 'admin@example.com'],
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toBe(true)
    expect(trackEvent).not.toHaveBeenCalled()
    expect(store.claim).toHaveBeenLastCalledWith('user:need_onboarding', 'org-123', 'org-123')
  })

  it('does not write the org-level claim when any unsent recipient is not already claimed', async () => {
    trackEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const store = createStore()

    const sent = await sendNotifToOrgMembersOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123',
      ['billing@example.com', 'admin@example.com'],
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toBe(false)
    expect(store.claim).not.toHaveBeenCalledWith('user:need_onboarding', 'org-123', 'org-123')
  })

  it('does not write the org-level claim when recipient cleanup fails', async () => {
    trackEvent.mockResolvedValue(false)
    const store = createStore({ deleteError: new Error('delete exploded') })

    const sent = await sendNotifToOrgMembersOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123',
      ['billing@example.com', 'admin@example.com'],
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toBe(false)
    expect(store.claim).not.toHaveBeenCalledWith('user:need_onboarding', 'org-123', 'org-123')
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      message: 'sendNotifToOrgMembersOnce: recipient cleanup failed',
      cleanupFailedRecipients: ['billing@example.com', 'admin@example.com'],
    }))
  })
})
