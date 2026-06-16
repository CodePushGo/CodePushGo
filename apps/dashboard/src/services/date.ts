const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/
const timezonePattern = /(Z|[+-]\d{2}:?\d{2})$/i

function locale() {
  return Intl.DateTimeFormat().resolvedOptions().locale || 'en'
}

function parseLocalDateOnly(value: string) {
  const match = value.match(dateOnlyPattern)
  if (!match)
    return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null
  return date
}

function parseDateInput(input: Date | string, options: { dateOnlyAsLocal?: boolean, zoneLessAsUtc?: boolean } = {}) {
  if (input instanceof Date)
    return Number.isNaN(input.getTime()) ? null : input

  const dateOnly = parseLocalDateOnly(input)
  if (dateOnly !== undefined)
    return options.dateOnlyAsLocal ? dateOnly : new Date(`${input}T00:00:00.000Z`)

  const source = options.zoneLessAsUtc && input.includes('T') && !timezonePattern.test(input)
    ? `${input}Z`
    : input
  const date = new Date(source)
  return Number.isNaN(date.getTime()) ? null : date
}

function format(input: Date | string, options: Intl.DateTimeFormatOptions, parseOptions?: { dateOnlyAsLocal?: boolean, zoneLessAsUtc?: boolean }) {
  const date = parseDateInput(input, parseOptions)
  return date ? new Intl.DateTimeFormat(locale(), options).format(date) : ''
}

export function formatLocalDate(input: Date | string) {
  return format(input, { year: 'numeric', month: 'short', day: 'numeric' }, { dateOnlyAsLocal: true, zoneLessAsUtc: true })
}

export function formatLocalDateShort(input: Date | string) {
  return format(input, { month: 'short', day: 'numeric' }, { dateOnlyAsLocal: true, zoneLessAsUtc: true })
}

export function formatLocalDateTime(input: Date | string) {
  return format(input, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }, { dateOnlyAsLocal: true, zoneLessAsUtc: true })
}

export function formatUtcDateTimeAsLocal(input: string) {
  return format(input, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }, { zoneLessAsUtc: true })
}

export function formatLocalMonthYear(input: Date | string) {
  return format(input, { month: 'short', year: 'numeric' }, { zoneLessAsUtc: true })
}

function inclusiveLocalDateLabels(startDate: Date, endDate: Date) {
  const labels: string[] = []
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

  while (cursor <= end) {
    labels.push(formatLocalDateShort(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return labels
}

export function generateChartDayLabels(useDateRange: boolean, startDate: Date, endDate: Date) {
  return useDateRange ? inclusiveLocalDateLabels(startDate, endDate) : []
}

export function generateMonthDays(useBillingCycle: boolean, cycleStart: Date, cycleEnd: Date) {
  return useBillingCycle ? inclusiveLocalDateLabels(cycleStart, cycleEnd) : []
}
