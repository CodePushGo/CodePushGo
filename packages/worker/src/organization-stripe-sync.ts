import type { OrganizationRecord } from '@codepushgo/shared'

export interface OrganizationStripeSyncDeps {
  updateCustomerOrganizationName?: (customerId: string, name: string) => Promise<void>
  getStripeCustomerName?: (customerId: string) => Promise<string | undefined>
  isDeterministicStripeCustomerUpdateError?: (error: unknown) => boolean
  rollbackOrganization?: (input: { orgId: string, name: string, managementEmail?: string, customerId?: string }) => Promise<OrganizationRecord | undefined>
}

export class OrganizationStripeSyncError extends Error {
  constructor(message: string, readonly moreInfo: Record<string, unknown>) {
    super(message)
    this.name = 'OrganizationStripeSyncError'
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function sanitizeOrganizationName(input: string) {
  return input.replace(/<[^>]*>/g, '').trim()
}

export async function syncOrganizationNameToStripeAfterCommit(
  previous: OrganizationRecord,
  committed: OrganizationRecord,
  deps: OrganizationStripeSyncDeps = {},
): Promise<void> {
  if (!committed.customerId || committed.customerId.startsWith('pending_') || previous.name === committed.name && !deps.updateCustomerOrganizationName)
    return
  if (!deps.updateCustomerOrganizationName)
    return

  try {
    await deps.updateCustomerOrganizationName(committed.customerId, committed.name)
    return
  }
  catch (error) {
    const stripeName = await deps.getStripeCustomerName?.(committed.customerId)
    if (stripeName === committed.name)
      return

    const deterministic = deps.isDeterministicStripeCustomerUpdateError?.(error) ?? false
    if (stripeName === undefined && !deterministic) {
      throw new OrganizationStripeSyncError('Stripe customer name sync state is unknown', {
        error: errorMessage(error),
        stripeSyncState: 'unknown',
      })
    }

    let rollbackError: string | undefined
    try {
      const rolledBack = await deps.rollbackOrganization?.({
        orgId: committed.id,
        name: previous.name,
        managementEmail: previous.managementEmail,
        customerId: previous.customerId,
      })
      if (deps.rollbackOrganization && !rolledBack)
        rollbackError = 'rollback returned no row'
    }
    catch (caughtRollbackError) {
      rollbackError = errorMessage(caughtRollbackError)
    }

    throw new OrganizationStripeSyncError('Stripe customer name sync failed', {
      error: errorMessage(error),
      ...(rollbackError ? { rollbackError } : {}),
    })
  }
}
