export interface CronSyncSubInput {
  orgId: string
  customerId?: string | null
}

export interface CronSyncSubDeps {
  sync(input: CronSyncSubInput): Promise<void>
}

export interface CronSyncSubResult {
  status: 'ok' | 'skipped'
  reason?: string
}

export async function runCronSyncSub(input: CronSyncSubInput, deps: CronSyncSubDeps): Promise<CronSyncSubResult> {
  try {
    await deps.sync(input)
    return { status: 'ok' }
  }
  catch (error) {
    if (isOrgNotFoundError(error))
      return { status: 'skipped', reason: 'org_not_found' }
    if (!isTransientCronSyncSubError(error))
      throw error
  }

  await deps.sync(input)
  return { status: 'ok' }
}

export function isTransientCronSyncSubError(error: unknown) {
  const status = getErrorStatus(error)
  if (status !== undefined)
    return status >= 500 && status < 600
  const message = getErrorMessage(error).toLowerCase()
  return /\b(502|503|504)\b/.test(message) || message.includes('timeout') || message.includes('temporarily unavailable')
}

function isOrgNotFoundError(error: unknown) {
  const cause = typeof error === 'object' && error !== null && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined
  if (typeof cause === 'object' && cause !== null && 'error' in cause && (cause as { error?: unknown }).error === 'org_not_found')
    return true
  return getErrorStatus(error) === 404 && getErrorMessage(error).toLowerCase().includes('org')
}

function getErrorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error)
    return error.message
  return typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : ''
}
