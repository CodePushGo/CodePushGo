export interface CustomerIdRow {
  customer_id?: string | null
}

export interface DailyRevenueChangeSummary {
  churnMrr: number
  contractionMrr: number
  expansionMrr: number
}

export interface CurrentDayWindow {
  dayStart: Date
  nextDayStart: Date
  dayDateId: string
}

function getDateId(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getCurrentDayWindow(referenceDate = new Date()): CurrentDayWindow {
  const dayStartMillis = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  const dayStart = new Date(dayStartMillis)
  const nextDayStart = new Date(dayStartMillis + 24 * 60 * 60 * 1000)
  return {
    dayStart,
    nextDayStart,
    dayDateId: getDateId(dayStart),
  }
}

export function getCompletedDayWindow(referenceDate = new Date()): CurrentDayWindow {
  const todayStartMillis = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  const dayStart = new Date(todayStartMillis - 24 * 60 * 60 * 1000)
  const nextDayStart = new Date(todayStartMillis)
  return {
    dayStart,
    nextDayStart,
    dayDateId: getDateId(dayStart),
  }
}

export function countUniqueCustomers(...rowSets: Array<Array<CustomerIdRow | null | undefined>>) {
  return new Set(
    rowSets
      .flat()
      .filter((row): row is CustomerIdRow => Boolean(row?.customer_id))
      .map(row => row.customer_id),
  ).size
}

export function calculateNrr(previousMrr: number, dailyChanges: DailyRevenueChangeSummary) {
  if (previousMrr <= 0)
    return 100

  const retainedMrr = Math.max(
    previousMrr - dailyChanges.churnMrr - dailyChanges.contractionMrr + dailyChanges.expansionMrr,
    0,
  )

  return Number(((retainedMrr / previousMrr) * 100).toFixed(2))
}

export function calculateChurnRevenue(dailyChanges: DailyRevenueChangeSummary) {
  return Number((dailyChanges.churnMrr + dailyChanges.contractionMrr).toFixed(2))
}

export const logsnagInsightsTestUtils = {
  calculateChurnRevenue,
  calculateNrr,
  countUniqueCustomers,
  getCompletedDayWindow,
  getCurrentDayWindow,
}
