export type CreditMetric = 'mau' | 'bandwidth' | 'storage' | 'build_time'

export interface CreditStep {
  type: CreditMetric
  step_min: number
  step_max: number
  price_per_unit: number
  unit_factor: number
  org_id?: string | null
}

export interface CreditUsageInput {
  mau?: number
  bandwidth?: number
  storage?: number
  build_time?: number
}

export const GLOBAL_CREDIT_STEPS: CreditStep[] = [
  { type: 'mau', step_min: 0, step_max: Number.MAX_SAFE_INTEGER, price_per_unit: 0.001, unit_factor: 1 },
  { type: 'bandwidth', step_min: 0, step_max: Number.MAX_SAFE_INTEGER, price_per_unit: 0.12, unit_factor: 1073741824 },
  { type: 'storage', step_min: 0, step_max: Number.MAX_SAFE_INTEGER, price_per_unit: 0.12, unit_factor: 1073741824 },
  { type: 'build_time', step_min: 0, step_max: 6000, price_per_unit: 0.16, unit_factor: 60 },
  { type: 'build_time', step_min: 6000, step_max: 30000, price_per_unit: 0.14, unit_factor: 60 },
  { type: 'build_time', step_min: 30000, step_max: 60000, price_per_unit: 0.12, unit_factor: 60 },
  { type: 'build_time', step_min: 60000, step_max: 120000, price_per_unit: 0.10, unit_factor: 60 },
  { type: 'build_time', step_min: 120000, step_max: 300000, price_per_unit: 0.09, unit_factor: 60 },
  { type: 'build_time', step_min: 300000, step_max: Number.MAX_SAFE_INTEGER, price_per_unit: 0.08, unit_factor: 60 },
]

export function normalizeCreditUsage(input: CreditUsageInput) {
  return {
    mau: Number(input.mau ?? 0),
    bandwidth: Number(input.bandwidth ?? 0),
    storage: Number(input.storage ?? 0),
    build_time: Number(input.build_time ?? 0),
  }
}

export function validateCreditUsage(input: ReturnType<typeof normalizeCreditUsage>) {
  for (const [metric, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0)
      return `invalid_${metric}`
  }
  return undefined
}

export function calculateMetricCost(metric: CreditMetric, usage: number, steps = GLOBAL_CREDIT_STEPS) {
  const tiers = steps
    .filter(step => step.type === metric)
    .sort((a, b) => a.step_min - b.step_min)
  let cost = 0
  for (const tier of tiers) {
    const cappedUsage = Math.min(usage, tier.step_max)
    const billable = Math.max(0, cappedUsage - tier.step_min)
    if (billable > 0)
      cost += (billable / tier.unit_factor) * tier.price_per_unit
    if (usage <= tier.step_max)
      break
  }
  return { cost, tiers }
}

export function calculateCreditCost(input: CreditUsageInput, steps = GLOBAL_CREDIT_STEPS) {
  const usage = normalizeCreditUsage(input)
  const breakdown = Object.fromEntries((['mau', 'bandwidth', 'storage', 'build_time'] as CreditMetric[]).map((metric) => {
    return [metric, calculateMetricCost(metric, usage[metric], steps)]
  })) as Record<CreditMetric, ReturnType<typeof calculateMetricCost>>
  const totalCost = Object.values(breakdown).reduce((sum, value) => sum + value.cost, 0)
  return { usage, breakdown, total_cost: totalCost }
}
