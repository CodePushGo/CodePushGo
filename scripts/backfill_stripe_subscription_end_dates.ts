export interface StripeSubscriptionItemSnapshot {
  current_period_end?: number | null
  current_period_start?: number | null
  plan?: {
    usage_type?: string | null
  } | null
}

export interface StripeSubscriptionSnapshot {
  cancel_at?: number | null
  cancel_at_period_end?: boolean | null
  ended_at?: number | null
  items: {
    data: StripeSubscriptionItemSnapshot[]
  }
}

function toIsoFromSeconds(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds))
    return null
  return new Date(seconds * 1000).toISOString()
}

function getLicensedSubscriptionItem(subscription: StripeSubscriptionSnapshot) {
  return subscription.items.data.find(item => item.plan?.usage_type === 'licensed') ?? subscription.items.data[0] ?? null
}

export function getStripeSubscriptionEndSnapshot(subscription: StripeSubscriptionSnapshot) {
  const item = getLicensedSubscriptionItem(subscription)
  const anchorStart = toIsoFromSeconds(item?.current_period_start)
  const anchorEnd = toIsoFromSeconds(item?.current_period_end)
  const itemPeriodEnd = typeof item?.current_period_end === 'number' ? item.current_period_end : null
  const endedAtSeconds = subscription.ended_at
    ?? subscription.cancel_at
    ?? (subscription.cancel_at_period_end ? itemPeriodEnd : null)

  return {
    subscription_anchor_start: anchorStart,
    subscription_anchor_end: anchorEnd,
    canceled_at: toIsoFromSeconds(endedAtSeconds),
  }
}
