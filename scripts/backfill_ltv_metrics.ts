const DATE_ID_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MONTH_MS = (365.2425 / 12) * 24 * 60 * 60 * 1000

export interface GlobalStatsLtvRow {
  average_ltv: number | string | null
  date_id: string
  longest_ltv: number | string | null
  shortest_ltv: number | string | null
}

export interface LtvSourcePlan {
  name: string | null
  price_m: number | null
  price_m_id: string | null
  price_y: number | null
  price_y_id: string | null
}

export interface LtvSourceRow {
  canceled_at: string | null
  created_at: string
  customer_id: string
  is_good_plan: boolean | null
  paid_at: string | null
  price_id: string | null
  status: string | null
  subscription_anchor_end: string | null
  subscription_anchor_start: string | null
  plans: LtvSourcePlan | LtvSourcePlan[] | null
}

export interface LtvMetricValues {
  average_ltv: number
  shortest_ltv: number
  longest_ltv: number
}

export interface LtvBackfillRow extends LtvMetricValues {
  changed: boolean
  current: Partial<LtvMetricValues>
  date_id: string
}

export function assertDateId(value: string, label: string) {
  if (!DATE_ID_REGEX.test(value))
    throw new Error(`${label} must use YYYY-MM-DD`)

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    throw new Error(`${label} must be a valid UTC date`)

  return value
}

function toDate(value: string | null | undefined) {
  if (!value)
    return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toMoney(value: number) {
  return Number(value.toFixed(2))
}

function toMetricNumber(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function getPlan(row: LtvSourceRow) {
  return Array.isArray(row.plans) ? row.plans[0] ?? null : row.plans
}

function getBillingValue(row: LtvSourceRow) {
  const plan = getPlan(row)
  if (!plan || !row.price_id)
    return null

  if (row.price_id === plan.price_y_id) {
    return {
      amount: Number(plan.price_y) || 0,
      periodMonths: 12,
    }
  }

  if (row.price_id === plan.price_m_id) {
    return {
      amount: Number(plan.price_m) || 0,
      periodMonths: 1,
    }
  }

  return null
}

function getKnownSubscriptionEnd(row: LtvSourceRow) {
  const canceledAt = toDate(row.canceled_at)
  if (canceledAt)
    return canceledAt

  if (row.status === 'canceled' || row.status === 'deleted')
    return toDate(row.subscription_anchor_end)

  return null
}

export function estimateCustomerLtv(row: LtvSourceRow, snapshotExclusiveEnd: Date) {
  if (row.is_good_plan !== true)
    return null

  const billingValue = getBillingValue(row)
  if (!billingValue || billingValue.amount <= 0)
    return null

  const start = toDate(row.paid_at)
  if (!start || start.getTime() >= snapshotExclusiveEnd.getTime())
    return null

  const knownEnd = getKnownSubscriptionEnd(row)
  const effectiveEnd = knownEnd && knownEnd.getTime() < snapshotExclusiveEnd.getTime()
    ? knownEnd
    : snapshotExclusiveEnd

  if (effectiveEnd.getTime() <= start.getTime())
    return null

  const elapsedMonths = (effectiveEnd.getTime() - start.getTime()) / MONTH_MS
  const paidPeriods = Math.max(1, Math.ceil((elapsedMonths / billingValue.periodMonths) - 1e-9))
  return toMoney(billingValue.amount * paidPeriods)
}

export function calculateLtvMetrics(rows: LtvSourceRow[], dateId: string): LtvMetricValues {
  assertDateId(dateId, 'dateId')

  const snapshotExclusiveEnd = new Date(`${dateId}T00:00:00.000Z`)
  snapshotExclusiveEnd.setUTCDate(snapshotExclusiveEnd.getUTCDate() + 1)

  const values = rows
    .map(row => estimateCustomerLtv(row, snapshotExclusiveEnd))
    .filter((value): value is number => value !== null && value > 0)

  if (values.length === 0) {
    return {
      average_ltv: 0,
      shortest_ltv: 0,
      longest_ltv: 0,
    }
  }

  const total = values.reduce((sum, value) => sum + value, 0)

  return {
    average_ltv: toMoney(total / values.length),
    shortest_ltv: toMoney(Math.min(...values)),
    longest_ltv: toMoney(Math.max(...values)),
  }
}

export function buildLtvBackfillRows(globalStatsRows: GlobalStatsLtvRow[], ltvSourceRows: LtvSourceRow[]) {
  return globalStatsRows.map((row): LtvBackfillRow => {
    const metrics = calculateLtvMetrics(ltvSourceRows, row.date_id)
    const current = {
      average_ltv: toMetricNumber(row.average_ltv),
      shortest_ltv: toMetricNumber(row.shortest_ltv),
      longest_ltv: toMetricNumber(row.longest_ltv),
    }
    const changed = current.average_ltv !== metrics.average_ltv
      || current.shortest_ltv !== metrics.shortest_ltv
      || current.longest_ltv !== metrics.longest_ltv

    return {
      date_id: row.date_id,
      current,
      changed,
      ...metrics,
    }
  })
}
