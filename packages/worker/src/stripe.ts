export interface StripeLikeEvent {
  type?: string
  created?: number
  data?: {
    object?: unknown
  }
}

export interface ExtractedStripeDataEvent {
  data: {
    customer_id: string | null
    status: string | null
    event_type: string | null
    event_created_at: string | null
  }
}

export interface StripePaidAtState {
  paid_at?: string | null
  status?: string | null
}

export interface CheckoutAttribution {
  visitorId?: string | null
  sessionId?: string | null
}

export interface CheckoutLineItemSummary {
  id: string | null
  quantity: number
  priceId: string | null
  productId: string | null
}

export function normalizeStripeCountryCode(value: unknown) {
  if (typeof value !== 'string')
    return null
  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

export function isStripeCustomerProfileEvent(event: StripeLikeEvent) {
  if (event.type !== 'customer.created' && event.type !== 'customer.updated')
    return false
  const object = event.data?.object
  return isRecord(object) && object.object === 'customer'
}

export function extractStripeDataEvent(event: StripeLikeEvent): ExtractedStripeDataEvent {
  const object = event.data?.object
  const customerId = isRecord(object) && typeof object.id === 'string'
    ? object.id
    : null
  return {
    data: {
      customer_id: customerId,
      status: event.type === 'customer.updated' ? 'updated' : event.type === 'customer.created' ? 'created' : null,
      event_type: event.type ?? null,
      event_created_at: typeof event.created === 'number' ? new Date(event.created * 1000).toISOString() : null,
    },
  }
}

export function getPaidAtUpdate(current: StripePaidAtState, nextStatus: string | null | undefined, eventOccurredAtIso: string) {
  if (current.paid_at)
    return undefined
  if (nextStatus === 'created')
    return eventOccurredAtIso
  if (nextStatus !== 'succeeded')
    return undefined
  return current.status === 'succeeded' ? undefined : eventOccurredAtIso
}

export function resolveStripeRedirectUrl(webappUrl: string, redirectPath: string, success = false) {
  const base = new URL(webappUrl)
  const candidate = new URL(redirectPath, base)
  if (candidate.origin !== base.origin) {
    const error = new Error('Invalid redirect URL') as Error & { status?: number, cause?: Record<string, string> }
    error.status = 400
    error.cause = { error: 'invalid_redirect_url' }
    throw error
  }
  if (success)
    candidate.searchParams.set('success', 'true')
  return candidate.toString()
}

export function buildCheckoutMetadata(orgId?: string | null, legacyAttributionId?: string | null, attribution?: CheckoutAttribution | null, intendedQuantity?: number, productId?: string) {
  return {
    ...(orgId ? { orgId } : {}),
    ...(legacyAttributionId ? { attribution_id: legacyAttributionId } : {}),
    ...(attribution?.visitorId ? { datafast_visitor_id: attribution.visitorId } : {}),
    ...(attribution?.sessionId ? { datafast_session_id: attribution.sessionId } : {}),
    ...(intendedQuantity !== undefined ? { intendedQuantity: String(intendedQuantity) } : {}),
    ...(productId ? { productId } : {}),
  }
}

export function buildOneTimeCheckoutLineItem(priceId: string, quantity: number, emulatorMode = false) {
  return {
    price: priceId,
    quantity,
    ...(emulatorMode ? {} : { adjustable_quantity: { enabled: true, minimum: 1 } }),
  }
}

export function getCreditCheckoutDetailsFromMetadata(session: { metadata?: Record<string, string> | null }, expectedProductId: string) {
  const quantity = Number(session.metadata?.intendedQuantity ?? 0)
  return {
    creditQuantity: Number.isFinite(quantity) ? quantity : 0,
    itemsSummary: [
      {
        id: null,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        priceId: null,
        productId: session.metadata?.productId ?? expectedProductId,
      },
    ] satisfies CheckoutLineItemSummary[],
  }
}

export function buildStripeCustomerEmailUpdate(email: string) {
  return {
    email,
    metadata: { email },
  }
}

export function buildStripeCustomerOrganizationNameUpdate(name: string) {
  return { name }
}

export function isDeterministicStripeCustomerUpdateError(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  return ['StripeAuthenticationError', 'StripeInvalidRequestError', 'StripePermissionError', 'StripeRateLimitError'].includes(name)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface StripeRevenuePlan {
  name: string
  stripe_id: string
  price_m: number
  price_m_id: string
  price_y: number
  price_y_id: string
}

export interface StripeRevenueState {
  is_good_plan?: boolean | null
  paid_at?: string | null
  price_id?: string | null
  product_id?: string | null
  status?: string | null
}

export interface StripeRevenueMovement {
  currentMrr: number
  nextMrr: number
  newBusinessMrr: number
  expansionMrr: number
  contractionMrr: number
  churnMrr: number
  lostPlan: string | null
}

const zeroRevenueMovement: StripeRevenueMovement = {
  currentMrr: 0,
  nextMrr: 0,
  newBusinessMrr: 0,
  expansionMrr: 0,
  contractionMrr: 0,
  churnMrr: 0,
  lostPlan: null,
}

export function classifyRevenueMovement(current: StripeRevenueState, next: StripeRevenueState, plans: readonly StripeRevenuePlan[]): StripeRevenueMovement {
  const currentPlan = getRevenuePlan(plans, current)
  const nextPlan = getRevenuePlan(plans, next)
  const currentMrr = getRevenuePlanMrr(currentPlan, current.price_id)
  const nextMrr = getRevenuePlanMrr(nextPlan, next.price_id)
  const lostPlan = normalizedPlanName(currentPlan?.name)

  if (currentMrr === 0 && nextMrr === 0)
    return { ...zeroRevenueMovement }

  if (currentMrr === 0 && nextMrr > 0) {
    if (!current.paid_at)
      return { ...zeroRevenueMovement, currentMrr, nextMrr, newBusinessMrr: nextMrr }
    return { ...zeroRevenueMovement, currentMrr, nextMrr, expansionMrr: nextMrr }
  }

  if (currentMrr > 0 && nextMrr === 0)
    return { ...zeroRevenueMovement, currentMrr, nextMrr, churnMrr: currentMrr, lostPlan }

  if (nextMrr > currentMrr)
    return { ...zeroRevenueMovement, currentMrr, nextMrr, expansionMrr: nextMrr - currentMrr }

  if (currentMrr > nextMrr)
    return { ...zeroRevenueMovement, currentMrr, nextMrr, contractionMrr: currentMrr - nextMrr, lostPlan }

  return { ...zeroRevenueMovement, currentMrr, nextMrr }
}

export function shouldTrackOrganizationUpgrade(hadExistingPaidSubscription: boolean, movement: StripeRevenueMovement) {
  return hadExistingPaidSubscription && (movement.expansionMrr > 0 || movement.contractionMrr > 0)
}

export function isStaleStripeEvent(current: { last_stripe_event_at?: string | null }, eventOccurredAtIso: string) {
  if (!current.last_stripe_event_at)
    return false
  return new Date(current.last_stripe_event_at).getTime() > new Date(eventOccurredAtIso).getTime()
}

function getRevenuePlan(plans: readonly StripeRevenuePlan[], state: StripeRevenueState) {
  if (state.status !== 'succeeded' || state.is_good_plan === false || !state.product_id)
    return null
  return plans.find(plan => plan.stripe_id === state.product_id) ?? null
}

function getRevenuePlanMrr(plan: StripeRevenuePlan | null | undefined, priceId: string | null | undefined) {
  if (!plan || !priceId)
    return 0
  if (plan.price_m_id === priceId)
    return Number(plan.price_m) || 0
  if (plan.price_y_id === priceId)
    return (Number(plan.price_y) || 0) / 12
  return 0
}

function normalizedPlanName(name: string | null | undefined) {
  const normalized = name?.toLowerCase()
  return normalized === 'solo' || normalized === 'maker' || normalized === 'team' || normalized === 'enterprise' ? normalized : null
}

export interface StripeSubscriptionItemLike {
  current_period_end?: number | null
  plan?: {
    id?: string | null
    interval?: string | null
    product?: string | null
    usage_type?: string | null
  } | null
  price?: {
    id?: string | null
    product?: string | { id?: string | null } | null
  } | null
}

export interface StripeSubscriptionLike {
  cancel_at_period_end?: boolean | null
  customer?: string | null
  id?: string | null
  items?: { data?: StripeSubscriptionItemLike[] }
}

export interface StripeSubscriptionEventLike {
  type?: string
  data?: {
    object?: StripeSubscriptionLike
    previous_attributes?: {
      items?: { data?: StripeSubscriptionItemLike[] }
    }
  }
}

export interface StripeSubscriptionData {
  data: {
    canceled_at?: string | null
    customer_id: string | null
    price_id: string | null
    product_id: string | null
    subscription_id: string | null
  }
  isUpgrade: boolean
  previousPriceId: string | null
  previousProductId: string | null
  previousPlanType: 'monthly' | 'yearly' | null
  planType: 'monthly' | 'yearly' | null
}

export function getLicensedSubscriptionItem(items: StripeSubscriptionItemLike[] | undefined) {
  return items?.find(item => item.plan?.usage_type === 'licensed') ?? items?.[0] ?? null
}

export function extractStripeSubscriptionData(event: StripeSubscriptionEventLike): StripeSubscriptionData {
  const subscription = event.data?.object ?? {}
  const item = getLicensedSubscriptionItem(subscription.items?.data)
  const previousItem = getLicensedSubscriptionItem(event.data?.previous_attributes?.items?.data)
  const planType = getSubscriptionItemPlanType(item)
  const previousPlanType = getSubscriptionItemPlanType(previousItem)
  const productId = getSubscriptionItemProductId(item)
  const previousProductId = getSubscriptionItemProductId(previousItem)
  const isUpgrade = Boolean(previousItem && previousProductId === productId && previousPlanType === 'monthly' && planType === 'yearly')

  return {
    data: {
      canceled_at: subscription.cancel_at_period_end ? getSubscriptionItemPeriodEndIso(item) : null,
      customer_id: subscription.customer ?? null,
      price_id: getSubscriptionItemPriceId(item),
      product_id: productId,
      subscription_id: subscription.id ?? null,
    },
    isUpgrade,
    previousPriceId: getSubscriptionItemPriceId(previousItem),
    previousProductId,
    previousPlanType,
    planType,
  }
}

export function getSubscriptionTrackingState(stripeData: Pick<StripeSubscriptionData, 'isUpgrade' | 'previousProductId' | 'previousPlanType' | 'planType' | 'data'>, statusName: string) {
  const productChanged = Boolean(stripeData.previousProductId && stripeData.previousProductId !== stripeData.data.product_id)
  if (stripeData.isUpgrade)
    return { shouldSendPlanChange: false, statusName: 'upgraded' }
  return {
    shouldSendPlanChange: productChanged,
    statusName,
  }
}

export function getPlanChangeTrackingEventName(statusName: string) {
  return statusName === 'upgraded' ? 'User Upgraded' : 'User Plan Changed'
}

export function buildSubscriptionEventMetadata(stripeData: StripeSubscriptionData, plan?: Pick<StripeRevenuePlan, 'name' | 'price_m_id' | 'price_y_id' | 'stripe_id'> | null, previousPlan?: Pick<StripeRevenuePlan, 'name' | 'price_m_id' | 'price_y_id' | 'stripe_id'> | null) {
  const resolvedPreviousPlan = previousPlan ?? (plan?.stripe_id === stripeData.previousProductId ? plan : null)
  return {
    plan_name: plan?.name ?? null,
    plan_type: stripeData.planType,
    previous_plan_name: resolvedPreviousPlan?.name ?? null,
    previous_plan_type: stripeData.previousPlanType,
  }
}

function getSubscriptionItemPriceId(item: StripeSubscriptionItemLike | null | undefined) {
  return item?.plan?.id ?? item?.price?.id ?? null
}

function getSubscriptionItemProductId(item: StripeSubscriptionItemLike | null | undefined) {
  const product = item?.price?.product
  if (typeof product === 'string')
    return product
  return item?.plan?.product ?? product?.id ?? null
}

function getSubscriptionItemPlanType(item: StripeSubscriptionItemLike | null | undefined): 'monthly' | 'yearly' | null {
  if (item?.plan?.interval === 'month')
    return 'monthly'
  if (item?.plan?.interval === 'year')
    return 'yearly'
  return null
}

function getSubscriptionItemPeriodEndIso(item: StripeSubscriptionItemLike | null | undefined) {
  return item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null
}
