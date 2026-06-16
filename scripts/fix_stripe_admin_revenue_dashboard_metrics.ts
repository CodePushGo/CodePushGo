export type PlanKey = 'enterprise' | 'maker' | 'solo' | 'team'
export type BillingInterval = 'monthly' | 'yearly'

export interface StripePriceLookupValue {
  interval: BillingInterval
  mrr: number
  plan: PlanKey
}

export interface StripeRevenueInterval {
  customerId: string
  endMs: number
  interval: BillingInterval
  mrr: number
  plan: PlanKey
  priceId: string
  sourceId: string
  startMs: number
  subscriptionId: string
}

interface GlobalStatsRevenueRow {
  date_id: string
  [key: string]: number | string
}

const planKeys: PlanKey[] = ['solo', 'maker', 'team', 'enterprise']

function numeric(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

export function classifyPlanKeyFromText(text: string | null | undefined): PlanKey | null {
  const value = text?.toLowerCase() ?? ''
  if (value.includes('enterprise'))
    return 'enterprise'
  if (value.includes('maker'))
    return 'maker'
  if (value.includes('team'))
    return 'team'
  if (value.includes('solo'))
    return 'solo'
  return null
}

function priceText(price: any) {
  const product = price?.product
  const productName = typeof product === 'object' ? product.name : ''
  return [price?.nickname, price?.lookup_key, productName, price?.id].filter(Boolean).join(' ')
}

function priceInterval(price: any): BillingInterval | null {
  const interval = price?.recurring?.interval
  if (interval === 'month')
    return 'monthly'
  if (interval === 'year')
    return 'yearly'
  return null
}

function priceMrr(price: any, interval: BillingInterval) {
  const amount = numeric(price?.unit_amount) / 100
  return interval === 'yearly' ? roundMoney(amount / 12) : roundMoney(amount)
}

export function buildStripePriceLookup(prices: any[], plans: Array<{ name?: string, price_m_id?: string, price_y_id?: string }> = []) {
  const lookup = new Map<string, StripePriceLookupValue>()

  for (const plan of plans) {
    const planKey = classifyPlanKeyFromText(plan.name)
    if (!planKey)
      continue
    if (plan.price_m_id)
      lookup.set(plan.price_m_id, { interval: 'monthly', mrr: 0, plan: planKey })
    if (plan.price_y_id)
      lookup.set(plan.price_y_id, { interval: 'yearly', mrr: 0, plan: planKey })
  }

  for (const price of prices) {
    const plan = classifyPlanKeyFromText(priceText(price))
    const interval = priceInterval(price)
    if (!price?.id || !plan || !interval)
      continue
    lookup.set(price.id, { interval, mrr: priceMrr(price, interval), plan })
  }

  return lookup
}

function dayStartMs(dateId: string) {
  return Date.parse(`${dateId}T00:00:00.000Z`)
}

function dayEndMs(dateId: string) {
  return Date.parse(`${dateId}T23:59:59.999Z`)
}

function activeIntervalsForDay(intervals: StripeRevenueInterval[], dateId: string) {
  const start = dayStartMs(dateId)
  const end = dayEndMs(dateId)
  const byCustomer = new Map<string, StripeRevenueInterval>()
  for (const interval of intervals) {
    if (interval.startMs > end || interval.endMs <= start)
      continue
    const current = byCustomer.get(interval.customerId)
    if (!current || interval.startMs > current.startMs)
      byCustomer.set(interval.customerId, interval)
  }
  return byCustomer
}

function firstIntervalDateByCustomer(intervals: StripeRevenueInterval[]) {
  const first = new Map<string, string>()
  for (const interval of intervals) {
    const dateId = new Date(interval.startMs).toISOString().slice(0, 10)
    const existing = first.get(interval.customerId)
    if (!existing || dateId < existing)
      first.set(interval.customerId, dateId)
  }
  return first
}

function emptyRevenueFields(row: GlobalStatsRevenueRow) {
  const next: Record<string, number | string> = { ...row }
  for (const key of [
    'mrr', 'total_revenue', 'paying', 'paying_monthly', 'paying_yearly', 'new_paying_orgs',
    'churn_revenue', 'churn_revenue_solo', 'churn_revenue_maker', 'churn_revenue_team', 'churn_revenue_enterprise',
    ...planKeys.flatMap(plan => [`plan_${plan}`, `plan_${plan}_monthly`, `plan_${plan}_yearly`, `revenue_${plan}`]),
  ]) {
    next[key] = 0
  }
  return next
}

function addPlanValue(row: Record<string, number | string>, plan: PlanKey, interval: BillingInterval, mrr: number) {
  row[`plan_${plan}`] = numeric(row[`plan_${plan}`]) + 1
  row[`plan_${plan}_${interval}`] = numeric(row[`plan_${plan}_${interval}`]) + 1
  row[`revenue_${plan}`] = roundMoney(numeric(row[`revenue_${plan}`]) + mrr * 12)
}

export function buildStripeInvoiceRevenueBackfillRows(rows: GlobalStatsRevenueRow[], input: { fromDateId: string, intervals: StripeRevenueInterval[], toDateId: string }) {
  const firstByCustomer = firstIntervalDateByCustomer(input.intervals)
  let previousByCustomer = new Map<string, StripeRevenueInterval>()

  return rows.map((row) => {
    const dateId = String(row.date_id)
    const active = activeIntervalsForDay(input.intervals, dateId)
    const next = emptyRevenueFields(row)

    next.paying = active.size
    for (const interval of active.values()) {
      next.mrr = roundMoney(numeric(next.mrr) + interval.mrr)
      next.total_revenue = roundMoney(numeric(next.total_revenue) + interval.mrr * 12)
      next[interval.interval === 'yearly' ? 'paying_yearly' : 'paying_monthly'] = numeric(next[interval.interval === 'yearly' ? 'paying_yearly' : 'paying_monthly']) + 1
      addPlanValue(next, interval.plan, interval.interval, interval.mrr)
    }

    for (const [customerId, previous] of previousByCustomer.entries()) {
      const current = active.get(customerId)
      const delta = previous.mrr - (current?.mrr ?? 0)
      if (delta > 0) {
        next.churn_revenue = roundMoney(numeric(next.churn_revenue) + delta)
        next[`churn_revenue_${previous.plan}`] = roundMoney(numeric(next[`churn_revenue_${previous.plan}`]) + delta)
      }
    }

    let newPayingOrgs = 0
    for (const customerId of active.keys()) {
      if (firstByCustomer.get(customerId) === dateId)
        newPayingOrgs++
    }
    next.new_paying_orgs = newPayingOrgs
    previousByCustomer = active
    return next
  })
}
