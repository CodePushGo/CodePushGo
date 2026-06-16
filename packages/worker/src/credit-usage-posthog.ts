export interface UsageCreditTransactionForEvent {
  amount: number
  balance_after?: number | null
  description?: string | null
  grant_id?: string | null
  id: number | string
  occurred_at?: string | null
  created_at?: string | null
  org_id: string
  source_ref?: { metric?: string, overage_event_id?: string | number } | null
  transaction_type?: string | null
}

export interface UsageOverageEventForEvent {
  id: string | number
  metric?: string | null
  org_id: string
  overage_amount?: number | string | null
  credits_debited?: number | string | null
  credits_consumed?: number | string | null
  details?: Record<string, unknown> | null
}

export interface CreditUsagePosthogEventInput {
  channel: 'usage'
  distinctId: string
  event: 'Credit Usage Ledger Entry'
  groups: { organization: string }
  timestamp: string
  tags: Record<string, unknown>
}

export interface BackfillRunTags {
  backfillRangeFrom: string
  backfillRangeTo: string
  backfillRunId: string
  backfillStartedAt: string
}

export function getBackfillProgressScopeKey(orgId?: string | null) {
  const trimmed = orgId?.trim()
  return trimmed ? `org:${trimmed}` : 'all_orgs'
}

export function buildCheckpointResumeFilter(lastOccurredAt: string, lastId: number | string) {
  return `occurred_at.gt.${lastOccurredAt},and(occurred_at.eq.${lastOccurredAt},id.gt.${lastId})`
}

export function resolveCutoverIso(input: { apply: boolean, configuredCutover?: string | null, progress?: { cutoverIso?: string | null } | null, to: Date }) {
  if (!input.apply)
    return input.to.toISOString()
  const cutover = input.progress?.cutoverIso ?? input.configuredCutover
  if (!cutover)
    throw new Error('Missing cutover timestamp')
  const date = new Date(cutover)
  if (!Number.isFinite(date.getTime()))
    throw new Error('Invalid cutover timestamp')
  return date.toISOString()
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function buildCreditUsagePosthogEventInput(transaction: UsageCreditTransactionForEvent, overageEvent?: UsageOverageEventForEvent | null, captureSource = 'backend'): CreditUsagePosthogEventInput {
  const timestamp = transaction.occurred_at ?? transaction.created_at ?? new Date().toISOString()
  const metric = overageEvent?.metric ?? transaction.source_ref?.metric ?? 'unknown'
  const overageEventId = overageEvent?.id ?? transaction.source_ref?.overage_event_id
  const details = overageEvent?.details ?? {}
  const creditsDelta = numberValue(transaction.amount)
  const creditsSpent = Math.abs(creditsDelta)
  return {
    channel: 'usage',
    distinctId: transaction.org_id,
    event: 'Credit Usage Ledger Entry',
    groups: { organization: transaction.org_id },
    timestamp,
    tags: {
      $insert_id: `usage_credit_transaction:${transaction.id}`,
      balance_after: transaction.balance_after,
      capture_source: captureSource,
      credits_delta: creditsDelta,
      credits_spent: creditsSpent,
      description: transaction.description,
      grant_id: transaction.grant_id,
      is_build_time_credit_usage: metric === 'build_time',
      limit: details.limit,
      metric,
      overage_amount: overageEvent?.overage_amount == null ? undefined : numberValue(overageEvent.overage_amount),
      overage_event_id: overageEventId,
      source_record_id: String(transaction.id),
      transaction_type: transaction.transaction_type,
      usage: details.usage,
    },
  }
}

export function addBackfillRunTags(input: CreditUsagePosthogEventInput, tags: BackfillRunTags) {
  input.tags.backfill_range_from = tags.backfillRangeFrom
  input.tags.backfill_range_to = tags.backfillRangeTo
  input.tags.backfill_run_id = tags.backfillRunId
  input.tags.backfill_started_at = tags.backfillStartedAt
  return input
}
