const DATABASE_URL_ENV_KEYS = [
  'MAIN_SUPABASE_DB_URL',
  'DATABASE_URL',
  'POSTGRES_URL',
  'SUPABASE_DB_URL',
  'SUPABASE_DB_DIRECT_URL',
  'DIRECT_URL',
] as const

const SUBSCRIPTION_EVENT_TYPES = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const

const EVENT_FETCH_PAGE_SIZE = 100

type SubscriptionEventType = typeof SUBSCRIPTION_EVENT_TYPES[number]
type RevenuePlanKey = 'solo' | 'maker' | 'team' | 'enterprise'
type StripeStatus = 'created' | 'updated' | 'succeeded' | 'failed' | 'deleted' | 'canceled'

export interface RevenuePlanRow {
  name: string | null
  price_m: number | string | null
  price_m_id: string | null
  price_y: number | string | null
  price_y_id: string | null
  stripe_id: string | null
}

export interface StripeSubscriptionItemLike {
  current_period_end?: number | null
  plan?: {
    id?: string | null
    product?: string | { id?: string | null } | null
    usage_type?: string | null
  } | null
  price?: {
    id?: string | null
    product?: string | { id?: string | null } | null
  } | null
}

export interface StripeSubscriptionLike {
  id?: string | null
  customer?: string | { id?: string | null } | null
  items?: {
    data?: StripeSubscriptionItemLike[]
  } | null
}

export interface StripeEventLike {
  id: string
  type: string
  created: number
  data: {
    object: StripeSubscriptionLike
    previous_attributes?: Partial<StripeSubscriptionLike> & { status?: string | null }
  }
}

interface StripeInfoRevenueState {
  is_good_plan?: boolean | null
  paid_at?: string | null
  price_id?: string | null
  product_id?: string | null
  status?: StripeStatus | null
}

interface TrackedSubscriptionState {
  customer_id: string
  is_good_plan: boolean
  paid_at: string | null
  price_id: string | null
  product_id: string | null
  status: StripeStatus | null
  subscription_id: string | null
}

export interface BackfillRevenueMovementEvent {
  event_id: string
  event_type: SubscriptionEventType
  date_id: string
  customer_id: string
  opening_mrr: number
  current_mrr: number
  next_mrr: number
  new_business_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  churn_mrr: number
  lost_plan: RevenuePlanKey | null
}

export interface DailyRevenueMetricRow {
  date_id: string
  customer_id: string
  opening_mrr: number | string | null
  new_business_mrr: number | string | null
  expansion_mrr: number | string | null
  contraction_mrr: number | string | null
  churn_mrr: number | string | null
  churn_mrr_solo?: number | string | null
  churn_mrr_maker?: number | string | null
  churn_mrr_team?: number | string | null
  churn_mrr_enterprise?: number | string | null
  contraction_mrr_solo?: number | string | null
  contraction_mrr_maker?: number | string | null
  contraction_mrr_team?: number | string | null
  contraction_mrr_enterprise?: number | string | null
}

export interface DailyRevenueMetricInsert extends DailyRevenueMetricRow {
  opening_mrr: number
  new_business_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  churn_mrr: number
  churn_mrr_solo: number
  churn_mrr_maker: number
  churn_mrr_team: number
  churn_mrr_enterprise: number
  contraction_mrr_solo: number
  contraction_mrr_maker: number
  contraction_mrr_team: number
  contraction_mrr_enterprise: number
}

interface BuildRevenueMovementEventsOptions {
  customerId?: string | null
  fromDateId: string
  initialPaidAtByCustomerId?: Map<string, string | null>
  toDateId: string
}

interface RevenueMovement {
  currentMrr: number
  nextMrr: number
  newBusinessMrr: number
  expansionMrr: number
  contractionMrr: number
  churnMrr: number
  lostPlan: RevenuePlanKey | null
}

const ZERO_REVENUE_MOVEMENT: RevenueMovement = {
  currentMrr: 0,
  nextMrr: 0,
  newBusinessMrr: 0,
  expansionMrr: 0,
  contractionMrr: 0,
  churnMrr: 0,
  lostPlan: null,
}

export function getDatabaseUrl(env: Record<string, string | undefined>) {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = env[key]?.trim()
    if (value)
      return value
  }

  return null
}

export function getRequiredDatabaseUrl(env: Record<string, string | undefined>) {
  const value = getDatabaseUrl(env)
  if (!value)
    throw new Error(`--apply requires ${DATABASE_URL_ENV_KEYS.join(', ')} so metric writes and processed-event markers are committed atomically`)

  try {
    const parsed = new URL(value)
    if (!parsed.protocol)
      throw new Error('Missing URL protocol')
  }
  catch {
    throw new Error(`--apply requires a valid Postgres URL from ${DATABASE_URL_ENV_KEYS.join(', ')}`)
  }

  return value
}

function isSupabasePoolerHost(databaseUrl: string) {
  const parsed = new URL(databaseUrl)
  const hostname = parsed.hostname.toLowerCase()
  const port = parsed.port || '5432'
  return port === '6543' && (hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.com'))
}

export function shouldAllowSelfSignedPgCertificate(env: Record<string, string | undefined>, databaseUrl?: string) {
  const allowSelfSigned = env.PG_ALLOW_SELF_SIGNED_CERT?.trim().toLowerCase()
  if (allowSelfSigned === 'true' || allowSelfSigned === '1')
    return true
  if (allowSelfSigned === 'false' || allowSelfSigned === '0')
    return false

  const rejectUnauthorized = env.PG_SSL_REJECT_UNAUTHORIZED?.trim()
  if (rejectUnauthorized === '0')
    return true
  if (rejectUnauthorized === '1')
    return false

  return databaseUrl ? isSupabasePoolerHost(databaseUrl) : false
}

function dateIdToStartSeconds(dateId: string) {
  return Math.floor(new Date(`${dateId}T00:00:00.000Z`).getTime() / 1000)
}

function dateIdToEndSeconds(dateId: string) {
  return Math.floor(new Date(`${dateId}T23:59:59.999Z`).getTime() / 1000)
}

function toStripeId(value: unknown) {
  if (!value)
    return null
  if (typeof value === 'string')
    return value
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string')
    return value.id
  return null
}

function isSubscriptionEventType(type: string): type is SubscriptionEventType {
  return SUBSCRIPTION_EVENT_TYPES.includes(type as SubscriptionEventType)
}

function sortStripeEvents(events: StripeEventLike[]) {
  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => left.event.created - right.event.created || left.index - right.index)
    .map(item => item.event)
}

function getEventCreatedIso(event: StripeEventLike) {
  return new Date(event.created * 1000).toISOString()
}

function getEventDateId(eventOccurredAtIso: string) {
  return new Date(eventOccurredAtIso).toISOString().slice(0, 10)
}

function compareDateIds(left: string, right: string) {
  return left.localeCompare(right)
}

function getLicensedSubscriptionItem(items: StripeSubscriptionItemLike[] | undefined) {
  return items?.find(item => item.plan?.usage_type === 'licensed') ?? items?.[0] ?? null
}

function getSubscriptionItems(subscription: StripeSubscriptionLike) {
  return subscription.items?.data
}

function getPreviousSubscriptionItems(event: StripeEventLike) {
  return event.data.previous_attributes?.items?.data
}

function getItemPriceId(item: StripeSubscriptionItemLike | null | undefined) {
  if (!item)
    return null

  return item.plan?.id ?? toStripeId(item.price) ?? null
}

function getItemProductId(item: StripeSubscriptionItemLike | null | undefined) {
  if (!item)
    return null

  return toStripeId(item.plan?.product) ?? toStripeId(item.price?.product) ?? null
}

function getItemPeriodEndIso(item: StripeSubscriptionItemLike | null | undefined) {
  if (!item?.current_period_end)
    return null

  return new Date(item.current_period_end * 1000).toISOString()
}

function isActiveUntilPeriodEnd(item: StripeSubscriptionItemLike | null | undefined, eventOccurredAtIso: string) {
  const periodEndIso = getItemPeriodEndIso(item)
  return Boolean(periodEndIso && new Date(periodEndIso).getTime() > new Date(eventOccurredAtIso).getTime())
}

function toBackfillStripeStatus(status: unknown): StripeStatus | null {
  if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'unpaid' || status === 'succeeded')
    return 'succeeded'
  if (status === 'incomplete' || status === 'incomplete_expired' || status === 'paused')
    return 'created'
  if (status === 'created' || status === 'updated' || status === 'failed' || status === 'deleted' || status === 'canceled')
    return status
  return null
}

function getPreviousSubscriptionStatus(event: StripeEventLike) {
  const previousAttributes = event.data.previous_attributes
  if (!previousAttributes || !Object.hasOwn(previousAttributes, 'status'))
    return { hasStatus: false, status: null as StripeStatus | null }

  return {
    hasStatus: true,
    status: toBackfillStripeStatus(previousAttributes.status),
  }
}

function getPlanKey(name: string | null | undefined): RevenuePlanKey | null {
  const normalized = name?.toLowerCase()
  if (normalized === 'solo' || normalized === 'maker' || normalized === 'team' || normalized === 'enterprise')
    return normalized
  return null
}

function createZeroPlanBreakdown() {
  return {
    solo: 0,
    maker: 0,
    team: 0,
    enterprise: 0,
  }
}

function getMovementPlanBreakdown(lostPlan: RevenuePlanKey | null, amount: number) {
  const breakdown = createZeroPlanBreakdown()
  if (lostPlan && amount > 0)
    breakdown[lostPlan] = amount
  return breakdown
}

function getPlanMrr(plan: RevenuePlanRow | null | undefined, priceId: string | null | undefined) {
  if (!plan || !priceId)
    return 0

  if (plan.price_m_id === priceId)
    return Number(plan.price_m) || 0

  if (plan.price_y_id === priceId)
    return (Number(plan.price_y) || 0) / 12

  return 0
}

function getPlanByProductId(plans: RevenuePlanRow[], productId: string | null | undefined) {
  if (!productId)
    return null

  return plans.find(plan => plan.stripe_id === productId) ?? null
}

function getSubscriptionPlan(plans: RevenuePlanRow[], stripeInfo: StripeInfoRevenueState | null | undefined) {
  if (stripeInfo?.status !== 'succeeded' || stripeInfo?.is_good_plan === false)
    return null

  return getPlanByProductId(plans, stripeInfo.product_id)
}

function getSubscriptionMrr(plans: RevenuePlanRow[], stripeInfo: StripeInfoRevenueState | null | undefined) {
  return getPlanMrr(getSubscriptionPlan(plans, stripeInfo), stripeInfo?.price_id)
}

function classifyRevenueMovement(
  currentStripeInfo: StripeInfoRevenueState,
  nextStripeInfo: StripeInfoRevenueState,
  plans: RevenuePlanRow[],
): RevenueMovement {
  const currentPlan = getSubscriptionPlan(plans, currentStripeInfo)
  const nextPlan = getSubscriptionPlan(plans, nextStripeInfo)
  const currentMrr = getPlanMrr(currentPlan, currentStripeInfo.price_id)
  const nextMrr = getPlanMrr(nextPlan, nextStripeInfo.price_id)
  const lostPlan = getPlanKey(currentPlan?.name)

  if (currentMrr === 0 && nextMrr === 0)
    return { ...ZERO_REVENUE_MOVEMENT }

  if (currentMrr === 0 && nextMrr > 0) {
    if (!currentStripeInfo.paid_at)
      return { ...ZERO_REVENUE_MOVEMENT, currentMrr, nextMrr, newBusinessMrr: nextMrr }

    return { ...ZERO_REVENUE_MOVEMENT, currentMrr, nextMrr, expansionMrr: nextMrr }
  }

  if (currentMrr > 0 && nextMrr === 0)
    return { ...ZERO_REVENUE_MOVEMENT, currentMrr, nextMrr, churnMrr: currentMrr, lostPlan }

  if (nextMrr > currentMrr)
    return { ...ZERO_REVENUE_MOVEMENT, currentMrr, nextMrr, expansionMrr: nextMrr - currentMrr }

  if (currentMrr > nextMrr)
    return { ...ZERO_REVENUE_MOVEMENT, currentMrr, nextMrr, contractionMrr: currentMrr - nextMrr, lostPlan }

  return { ...ZERO_REVENUE_MOVEMENT, currentMrr, nextMrr }
}

function hasRevenueMovement(movement: RevenueMovement) {
  return movement.newBusinessMrr > 0
    || movement.expansionMrr > 0
    || movement.contractionMrr > 0
    || movement.churnMrr > 0
}

function toRevenueState(state: TrackedSubscriptionState): StripeInfoRevenueState {
  return {
    is_good_plan: state.is_good_plan,
    paid_at: state.paid_at,
    price_id: state.price_id,
    product_id: state.product_id,
    status: state.status,
  }
}

function getKnownPaidAtBefore(
  customerId: string,
  eventOccurredAtIso: string,
  trackedPaidAt: string | null | undefined,
  initialPaidAtByCustomerId?: Map<string, string | null>,
) {
  const paidAt = trackedPaidAt ?? initialPaidAtByCustomerId?.get(customerId) ?? null
  if (!paidAt)
    return null

  return new Date(paidAt).getTime() < new Date(eventOccurredAtIso).getTime() ? paidAt : null
}

function buildTrackedState(
  customerId: string,
  subscriptionId: string | null,
  status: StripeStatus | null,
  priceId: string | null,
  productId: string | null,
  paidAt: string | null,
): TrackedSubscriptionState {
  return {
    customer_id: customerId,
    is_good_plan: true,
    paid_at: paidAt,
    price_id: priceId,
    product_id: productId,
    status,
    subscription_id: subscriptionId,
  }
}

function toMovementEvent(event: StripeEventLike, customerId: string, dateId: string, movement: RevenueMovement): BackfillRevenueMovementEvent {
  return {
    event_id: event.id,
    event_type: event.type as SubscriptionEventType,
    date_id: dateId,
    customer_id: customerId,
    opening_mrr: movement.currentMrr,
    current_mrr: movement.currentMrr,
    next_mrr: movement.nextMrr,
    new_business_mrr: movement.newBusinessMrr,
    expansion_mrr: movement.expansionMrr,
    contraction_mrr: movement.contractionMrr,
    churn_mrr: movement.churnMrr,
    lost_plan: movement.lostPlan,
  }
}

export function buildRevenueMovementEvents(events: StripeEventLike[], plans: RevenuePlanRow[], options: BuildRevenueMovementEventsOptions) {
  const movements: BackfillRevenueMovementEvent[] = []
  const customerStates = new Map<string, TrackedSubscriptionState>()
  const skipped = {
    missingCustomer: 0,
    missingPlan: 0,
    noMovement: 0,
    outOfRange: 0,
    subscriptionMismatch: 0,
    unsupportedEvent: 0,
  }

  for (const event of sortStripeEvents(events)) {
    if (!isSubscriptionEventType(event.type)) {
      skipped.unsupportedEvent += 1
      continue
    }

    const eventOccurredAtIso = getEventCreatedIso(event)
    const dateId = getEventDateId(eventOccurredAtIso)
    const isBeforeRange = compareDateIds(dateId, options.fromDateId) < 0
    if (compareDateIds(dateId, options.toDateId) > 0) {
      skipped.outOfRange += 1
      continue
    }

    const subscription = event.data.object
    const customerId = toStripeId(subscription.customer)
    if (!customerId) {
      skipped.missingCustomer += 1
      continue
    }
    if (options.customerId && customerId !== options.customerId) {
      skipped.outOfRange += 1
      continue
    }

    const subscriptionId = subscription.id ?? null
    const currentItem = getLicensedSubscriptionItem(getSubscriptionItems(subscription))
    const currentPriceId = getItemPriceId(currentItem)
    const currentProductId = getItemProductId(currentItem)
    if (!currentPriceId || !currentProductId) {
      skipped.missingPlan += 1
      continue
    }

    const trackedState = customerStates.get(customerId)
    const previousItem = getLicensedSubscriptionItem(getPreviousSubscriptionItems(event))
    const previousStatusChange = getPreviousSubscriptionStatus(event)
    const shouldReuseCurrentPlanForPreviousState = !trackedState && !previousItem && previousStatusChange.status === 'succeeded'
    const previousPriceId = getItemPriceId(previousItem) ?? trackedState?.price_id ?? (shouldReuseCurrentPlanForPreviousState ? currentPriceId : null)
    const previousProductId = getItemProductId(previousItem) ?? trackedState?.product_id ?? (shouldReuseCurrentPlanForPreviousState ? currentProductId : null)
    const previousStatus = trackedState?.status ?? (previousItem ? 'succeeded' : previousStatusChange.status)
    const previousMrr = getSubscriptionMrr(plans, {
      is_good_plan: true,
      paid_at: trackedState?.paid_at ?? eventOccurredAtIso,
      price_id: previousPriceId,
      product_id: previousProductId,
      status: previousStatus,
    })
    const knownPaidAt = getKnownPaidAtBefore(customerId, eventOccurredAtIso, trackedState?.paid_at, options.initialPaidAtByCustomerId)
    const activePaidAt = trackedState?.paid_at ?? knownPaidAt ?? (previousMrr > 0 ? eventOccurredAtIso : null)

    let currentState: TrackedSubscriptionState
    let nextState: TrackedSubscriptionState

    if (event.type === 'customer.subscription.created') {
      currentState = buildTrackedState(customerId, null, 'created', null, null, knownPaidAt)
      nextState = buildTrackedState(customerId, subscriptionId, 'succeeded', currentPriceId, currentProductId, knownPaidAt ?? eventOccurredAtIso)
    }
    else if (event.type === 'customer.subscription.updated') {
      const hasPreviousRevenueState = Boolean(trackedState || previousItem || previousStatusChange.status)
      currentState = buildTrackedState(customerId, subscriptionId, previousMrr > 0 ? 'succeeded' : 'updated', previousPriceId, previousProductId, activePaidAt)
      nextState = buildTrackedState(customerId, subscriptionId, 'succeeded', currentPriceId, currentProductId, activePaidAt ?? eventOccurredAtIso)
      if (!hasPreviousRevenueState) {
        customerStates.set(customerId, nextState)
        if (isBeforeRange)
          skipped.outOfRange += 1
        else
          skipped.noMovement += 1
        continue
      }
    }
    else {
      const baselineSubscriptionId = trackedState?.subscription_id ?? null
      if (baselineSubscriptionId && baselineSubscriptionId !== subscriptionId) {
        skipped.subscriptionMismatch += 1
        continue
      }

      currentState = buildTrackedState(customerId, subscriptionId, 'succeeded', trackedState?.price_id ?? currentPriceId, trackedState?.product_id ?? currentProductId, activePaidAt ?? eventOccurredAtIso)
      nextState = buildTrackedState(customerId, subscriptionId, isActiveUntilPeriodEnd(currentItem, eventOccurredAtIso) ? 'succeeded' : 'deleted', currentPriceId, currentProductId, activePaidAt ?? eventOccurredAtIso)
    }

    const movement = classifyRevenueMovement(toRevenueState(currentState), toRevenueState(nextState), plans)
    customerStates.set(customerId, nextState)

    if (isBeforeRange) {
      skipped.outOfRange += 1
      continue
    }

    if (!hasRevenueMovement(movement)) {
      skipped.noMovement += 1
      continue
    }

    movements.push(toMovementEvent(event, customerId, dateId, movement))
  }

  return { movements, skipped }
}

export function aggregateRevenueMovementEvents(movements: BackfillRevenueMovementEvent[]): DailyRevenueMetricInsert[] {
  const metricsByKey = new Map<string, DailyRevenueMetricInsert>()

  for (const movement of movements) {
    const key = `${movement.date_id}:${movement.customer_id}`
    const existing = metricsByKey.get(key)
    const churnBreakdown = getMovementPlanBreakdown(movement.lost_plan, movement.churn_mrr)
    const contractionBreakdown = getMovementPlanBreakdown(movement.lost_plan, movement.contraction_mrr)

    if (!existing) {
      metricsByKey.set(key, {
        date_id: movement.date_id,
        customer_id: movement.customer_id,
        opening_mrr: movement.opening_mrr,
        new_business_mrr: movement.new_business_mrr,
        expansion_mrr: movement.expansion_mrr,
        contraction_mrr: movement.contraction_mrr,
        churn_mrr: movement.churn_mrr,
        churn_mrr_solo: churnBreakdown.solo,
        churn_mrr_maker: churnBreakdown.maker,
        churn_mrr_team: churnBreakdown.team,
        churn_mrr_enterprise: churnBreakdown.enterprise,
        contraction_mrr_solo: contractionBreakdown.solo,
        contraction_mrr_maker: contractionBreakdown.maker,
        contraction_mrr_team: contractionBreakdown.team,
        contraction_mrr_enterprise: contractionBreakdown.enterprise,
      })
      continue
    }

    existing.new_business_mrr += movement.new_business_mrr
    existing.expansion_mrr += movement.expansion_mrr
    existing.contraction_mrr += movement.contraction_mrr
    existing.churn_mrr += movement.churn_mrr
    existing.churn_mrr_solo += churnBreakdown.solo
    existing.churn_mrr_maker += churnBreakdown.maker
    existing.churn_mrr_team += churnBreakdown.team
    existing.churn_mrr_enterprise += churnBreakdown.enterprise
    existing.contraction_mrr_solo += contractionBreakdown.solo
    existing.contraction_mrr_maker += contractionBreakdown.maker
    existing.contraction_mrr_team += contractionBreakdown.team
    existing.contraction_mrr_enterprise += contractionBreakdown.enterprise
  }

  return [...metricsByKey.values()].sort((left, right) => left.date_id.localeCompare(right.date_id) || left.customer_id.localeCompare(right.customer_id))
}

export function summarizeDailyRevenueMetrics(rows: Pick<DailyRevenueMetricInsert, 'churn_mrr' | 'contraction_mrr' | 'expansion_mrr' | 'new_business_mrr' | 'opening_mrr'>[]) {
  return rows.reduce((summary, row) => {
    summary.rows += 1
    summary.opening_mrr += Number(row.opening_mrr) || 0
    summary.new_business_mrr += Number(row.new_business_mrr) || 0
    summary.expansion_mrr += Number(row.expansion_mrr) || 0
    summary.contraction_mrr += Number(row.contraction_mrr) || 0
    summary.churn_mrr += Number(row.churn_mrr) || 0
    return summary
  }, {
    rows: 0,
    opening_mrr: 0,
    new_business_mrr: 0,
    expansion_mrr: 0,
    contraction_mrr: 0,
    churn_mrr: 0,
  })
}

export function mergeMetricRows(existingRows: DailyRevenueMetricRow[], rowsToAdd: DailyRevenueMetricInsert[]) {
  const existingByKey = new Map(existingRows.map(row => [`${row.date_id}:${row.customer_id}`, row]))

  return rowsToAdd.map((row) => {
    const existing = existingByKey.get(`${row.date_id}:${row.customer_id}`)
    if (!existing)
      return row

    return {
      date_id: row.date_id,
      customer_id: row.customer_id,
      opening_mrr: existing.opening_mrr ?? row.opening_mrr ?? 0,
      new_business_mrr: (Number(existing.new_business_mrr) || 0) + row.new_business_mrr,
      expansion_mrr: (Number(existing.expansion_mrr) || 0) + row.expansion_mrr,
      contraction_mrr: (Number(existing.contraction_mrr) || 0) + row.contraction_mrr,
      churn_mrr: (Number(existing.churn_mrr) || 0) + row.churn_mrr,
      churn_mrr_solo: (Number(existing.churn_mrr_solo) || 0) + row.churn_mrr_solo,
      churn_mrr_maker: (Number(existing.churn_mrr_maker) || 0) + row.churn_mrr_maker,
      churn_mrr_team: (Number(existing.churn_mrr_team) || 0) + row.churn_mrr_team,
      churn_mrr_enterprise: (Number(existing.churn_mrr_enterprise) || 0) + row.churn_mrr_enterprise,
      contraction_mrr_solo: (Number(existing.contraction_mrr_solo) || 0) + row.contraction_mrr_solo,
      contraction_mrr_maker: (Number(existing.contraction_mrr_maker) || 0) + row.contraction_mrr_maker,
      contraction_mrr_team: (Number(existing.contraction_mrr_team) || 0) + row.contraction_mrr_team,
      contraction_mrr_enterprise: (Number(existing.contraction_mrr_enterprise) || 0) + row.contraction_mrr_enterprise,
    }
  })
}

export function findMissingResetSnapshotEventIds(movements: BackfillRevenueMovementEvent[], processedEventIds: string[], sampleSize = 10) {
  const snapshotEventIds = new Set(movements.map(movement => movement.event_id))
  const missingEventIds: string[] = []

  for (const eventId of processedEventIds) {
    if (!snapshotEventIds.has(eventId))
      missingEventIds.push(eventId)
    if (missingEventIds.length >= sampleSize)
      break
  }

  return missingEventIds
}

export async function fetchStripeEvents(
  stripe: { events: { list: (params: unknown) => AsyncIterable<StripeEventLike> } },
  fromDateId: string,
  toDateId: string,
  limit: number | null,
) {
  const events: StripeEventLike[] = []
  const params = {
    created: {
      gte: dateIdToStartSeconds(fromDateId),
      lte: dateIdToEndSeconds(toDateId),
    },
    limit: EVENT_FETCH_PAGE_SIZE,
    types: [...SUBSCRIPTION_EVENT_TYPES],
  }

  for await (const event of stripe.events.list(params)) {
    events.push(event)
    if (limit && events.length >= limit) {
      return {
        events: sortStripeEvents(events),
        reachedLimit: true,
      }
    }
  }

  return {
    events: sortStripeEvents(events),
    reachedLimit: false,
  }
}
