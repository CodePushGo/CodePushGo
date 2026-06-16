import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotifOrgOnce, type NotificationClaimStore } from '../src/notifications'

function createContext() {
  return {
    get: (key: string) => key === 'requestId' ? 'request-id' : undefined,
  }
}

function createStore(options?: { claimed?: boolean, deleteError?: Error }): NotificationClaimStore & { claim: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> } {
  return {
    claim: vi.fn().mockResolvedValue(options?.claimed ?? true),
    delete: options?.deleteError
      ? vi.fn().mockRejectedValue(options.deleteError)
      : vi.fn().mockResolvedValue(undefined),
  }
}

describe('[Capgo parity] sendNotifOrgOnce', () => {
  const trackEvent = vi.fn()
  const logError = vi.fn()
  const log = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes the recipient claim when Bento throws', async () => {
    trackEvent.mockRejectedValue(new Error('bento exploded'))
    const store = createStore()

    const sent = await sendNotifOrgOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123:recipient',
      'billing@example.com',
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toEqual({ sent: false, cleanupFailed: false })
    expect(store.delete).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledWith(expect.anything(), 'sendNotifOrgOnce', expect.any(Error))
  })

  it('surfaces cleanup failure when the recipient claim cannot be deleted', async () => {
    trackEvent.mockResolvedValue(false)
    const store = createStore({ deleteError: new Error('delete exploded') })

    const sent = await sendNotifOrgOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123:recipient',
      'billing@example.com',
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toEqual({ sent: false, cleanupFailed: true })
    expect(logError).toHaveBeenCalledWith(expect.anything(), 'sendNotifOrgOnce cleanup', expect.any(Error))
  })

  it('does not send when the one-time claim already exists', async () => {
    const store = createStore({ claimed: false })

    const sent = await sendNotifOrgOnce(
      createContext(),
      'user:need_onboarding',
      { org_id: 'org-123' },
      'org-123',
      'org-123:recipient',
      'billing@example.com',
      store,
      { trackEvent, logError, log },
    )

    expect(sent).toEqual({ sent: false, cleanupFailed: false })
    expect(trackEvent).not.toHaveBeenCalled()
    expect(store.delete).not.toHaveBeenCalled()
  })
})
