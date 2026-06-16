export interface NotificationContext {
  get(key: string): unknown
}

export interface NotificationClaimStore {
  claim(eventName: string, orgId: string, uniqId: string): Promise<boolean>
  delete(eventName: string, orgId: string, uniqId: string): Promise<void>
}

export interface OrgNotificationClaimStore extends NotificationClaimStore {
  has(eventName: string, orgId: string, uniqId: string): Promise<boolean | null>
}

export interface SendNotifOrgOnceDeps {
  trackEvent: (c: NotificationContext, recipientEmail: string, eventData: Record<string, unknown>, eventName: string) => Promise<boolean>
  logError: (c: NotificationContext, source: string, error: unknown) => void
  log?: (message: unknown) => void
}

export interface SendNotifOrgOnceResult {
  sent: boolean
  cleanupFailed: boolean
}

export interface EligibleEmailTargets {
  allEmails: string[]
  primaryEmail: string | null
  additionalEmails: string[]
}

export function getEligibleEmailTargets(adminEmails: string[], managementEmail: string | null | undefined): EligibleEmailTargets {
  const uniqueAdminEmails = [...new Set(adminEmails.filter(email => email.trim() !== ''))]
  const normalizedManagementEmail = managementEmail?.trim() || null
  const allEmails = normalizedManagementEmail === null || uniqueAdminEmails.includes(normalizedManagementEmail)
    ? uniqueAdminEmails
    : [...uniqueAdminEmails, normalizedManagementEmail]
  const primaryEmail = normalizedManagementEmail !== null && allEmails.includes(normalizedManagementEmail)
    ? normalizedManagementEmail
    : (uniqueAdminEmails[0] ?? null)
  const additionalEmails = primaryEmail === null
    ? []
    : allEmails.filter(email => email !== primaryEmail)

  return { allEmails, primaryEmail, additionalEmails }
}

export async function sendNotifOrgOnce(
  c: NotificationContext,
  eventName: string,
  eventData: Record<string, unknown>,
  orgId: string,
  uniqId: string,
  recipientEmail: string,
  store: NotificationClaimStore,
  deps: SendNotifOrgOnceDeps,
): Promise<SendNotifOrgOnceResult> {
  const claimed = await store.claim(eventName, orgId, uniqId)
  if (!claimed) {
    deps.log?.({ requestId: c.get('requestId'), message: 'notif once already claimed', event: eventName, orgId, uniqId })
    return { sent: false, cleanupFailed: false }
  }

  const cleanupClaim = async () => {
    try {
      await store.delete(eventName, orgId, uniqId)
      return true
    }
    catch (cleanupError) {
      deps.logError(c, 'sendNotifOrgOnce cleanup', cleanupError)
      return false
    }
  }

  try {
    const sent = await deps.trackEvent(c, recipientEmail, eventData, eventName)
    if (!sent) {
      const cleanupSucceeded = await cleanupClaim()
      deps.log?.({ requestId: c.get('requestId'), message: 'trackEvent failed for one-time notif', eventName, email: recipientEmail, eventData })
      return { sent: false, cleanupFailed: !cleanupSucceeded }
    }

    deps.log?.({ requestId: c.get('requestId'), message: 'send one-time notif done', eventName, email: recipientEmail, uniqId })
    return { sent: true, cleanupFailed: false }
  }
  catch (error) {
    const cleanupSucceeded = await cleanupClaim()
    deps.logError(c, 'sendNotifOrgOnce', error)
    return { sent: false, cleanupFailed: !cleanupSucceeded }
  }
}

export async function sendNotifToOrgMembersOnce(
  c: NotificationContext,
  eventName: string,
  eventData: Record<string, unknown>,
  orgId: string,
  uniqId: string,
  recipients: string[],
  store: OrgNotificationClaimStore,
  deps: SendNotifOrgOnceDeps,
): Promise<boolean> {
  const orgClaim = await store.has(eventName, orgId, uniqId)
  if (orgClaim === true)
    return false
  if (orgClaim === null) {
    deps.log?.({ requestId: c.get('requestId'), message: 'sendNotifToOrgMembersOnce: org claim lookup failed', orgId, uniqId })
    return false
  }

  const uniqueRecipients = [...new Set(recipients.filter(email => email.trim() !== ''))]
  const cleanupFailedRecipients: string[] = []
  let allRecipientsSentOrAlreadyClaimed = uniqueRecipients.length > 0

  for (const recipientEmail of uniqueRecipients) {
    const recipientUniqId = `${uniqId}:${recipientEmail}`
    const result = await sendNotifOrgOnce(c, eventName, eventData, orgId, recipientUniqId, recipientEmail, store, deps)
    if (result.cleanupFailed) {
      cleanupFailedRecipients.push(recipientEmail)
      allRecipientsSentOrAlreadyClaimed = false
      continue
    }

    if (!result.sent) {
      const recipientClaim = await store.has(eventName, orgId, recipientUniqId)
      if (recipientClaim !== true)
        allRecipientsSentOrAlreadyClaimed = false
    }
  }

  if (cleanupFailedRecipients.length > 0) {
    deps.log?.({ requestId: c.get('requestId'), message: 'sendNotifToOrgMembersOnce: recipient cleanup failed', cleanupFailedRecipients })
    return false
  }

  if (!allRecipientsSentOrAlreadyClaimed)
    return false

  return store.claim(eventName, orgId, uniqId)
}
