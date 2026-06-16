export type CreditPricingType = 'bandwidth' | 'mau' | 'build_time'

export interface CreditPricingTier {
  type: CreditPricingType | string
  step_min: number
  step_max: number
  price_per_unit?: number
  unit_factor: number
}

export type CreditPricingTranslate = (key: string, values?: Record<string, string | number>) => string

const UNIT_LABEL_KEYS: Record<CreditPricingType, string> = {
  bandwidth: 'credits-pricing-unit-per-gib',
  mau: 'credits-pricing-unit-per-mau',
  build_time: 'credits-pricing-unit-per-minute',
}

function knownPricingType(type: string): CreditPricingType {
  return type === 'bandwidth' || type === 'mau' || type === 'build_time' ? type : 'mau'
}

function formatPrice(price: number) {
  return `$${price.toFixed(2).replace(/\.00$/, '')}`
}

function formatTierEndpoint(tier: CreditPricingTier, value: number, t: CreditPricingTranslate) {
  const normalized = Math.ceil(value / Math.max(1, tier.unit_factor))
  if (knownPricingType(tier.type) === 'build_time')
    return t('minutes-short', { minutes: normalized })
  return String(normalized)
}

export function formatCreditPricingTierLabel(tier: CreditPricingTier, t: CreditPricingTranslate) {
  if (tier.step_min <= 0)
    return t('credits-pricing-tier-first', { to: formatTierEndpoint(tier, tier.step_max, t) })
  if (tier.step_max >= Number.MAX_SAFE_INTEGER)
    return t('credits-pricing-tier-over', { from: formatTierEndpoint(tier, tier.step_min, t) })
  return t('credits-pricing-tier-range', {
    from: formatTierEndpoint(tier, tier.step_min, t),
    to: formatTierEndpoint(tier, tier.step_max, t),
  })
}

export function formatCreditPricingPrice(type: CreditPricingType | string, price: number, t: CreditPricingTranslate) {
  const pricingType = knownPricingType(type)
  return t('credits-pricing-price', { price: formatPrice(price), unit: t(UNIT_LABEL_KEYS[pricingType]) })
}

export function getFirstTierCreditUnitPricing(steps: CreditPricingTier[]) {
  return steps.reduce<Partial<Record<CreditPricingType, number>>>((prices, step) => {
    const pricingType = knownPricingType(step.type)
    if (step.step_min === 0 && step.price_per_unit !== undefined && prices[pricingType] === undefined)
      prices[pricingType] = step.price_per_unit
    return prices
  }, {})
}

export function formatIncludedThenPrice(type: CreditPricingType | string, price: number, t: CreditPricingTranslate) {
  return t('credits-plan-overage', {
    included: t('included-in-plan'),
    price: formatCreditPricingPrice(type, price, t),
  })
}
