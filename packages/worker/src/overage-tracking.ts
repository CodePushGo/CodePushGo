import type { ConsumeUsageCreditsInput, UsageOverageEventRecord } from './storage'

function detailString(details: Record<string, unknown>, key: string) {
  const value = details[key]
  return typeof value === 'string' ? value : undefined
}

function billingCycleKey(details: Record<string, unknown>) {
  const start = detailString(details, 'billingCycleStart') ?? detailString(details, 'billing_cycle_start')
  const end = detailString(details, 'billingCycleEnd') ?? detailString(details, 'billing_cycle_end')
  return start && end ? `${start}|${end}` : undefined
}

export function findMatchingUsageOverageEvent(existingEvents: UsageOverageEventRecord[], input: ConsumeUsageCreditsInput) {
  if (!input.metric || input.overageAmount === undefined)
    return undefined
  const inputCycle = billingCycleKey(input.details ?? {})
  if (!inputCycle)
    return undefined

  return existingEvents.find((event) => {
    return event.metric === input.metric && billingCycleKey(event.details) === inputCycle
  })
}

export function shouldCreateUsageOverageEvent(existingEvent: UsageOverageEventRecord | undefined, input: ConsumeUsageCreditsInput) {
  if (!input.metric || input.overageAmount === undefined)
    return false
  if (!existingEvent)
    return true

  const previous = existingEvent.overageAmount
  if (previous <= 0)
    return input.overageAmount > previous
  return input.overageAmount >= previous * 1.01
}
