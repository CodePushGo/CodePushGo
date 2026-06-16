import { describe, expect, it } from 'vitest'
import { classifyRevenueMovement, isStaleStripeEvent, shouldTrackOrganizationUpgrade } from '../src/stripe'

const plans = [
  {
    name: 'Solo',
    stripe_id: 'prod_solo',
    price_m: 12,
    price_m_id: 'price_solo_monthly',
    price_y: 120,
    price_y_id: 'price_solo_yearly',
  },
  {
    name: 'Team',
    stripe_id: 'prod_team',
    price_m: 49,
    price_m_id: 'price_team_monthly',
    price_y: 468,
    price_y_id: 'price_team_yearly',
  },
] as const

describe('stripe revenue movement classification', () => {
  it.concurrent('records first-time subscriptions as new business MRR', () => {
    expect(classifyRevenueMovement(
      {
        paid_at: null,
        price_id: null,
        product_id: null,
        status: 'created',
      },
      {
        is_good_plan: true,
        paid_at: '2026-04-22T12:00:00.000Z',
        price_id: 'price_solo_monthly',
        product_id: 'prod_solo',
        status: 'succeeded',
      },
      plans,
    )).toMatchObject({
      currentMrr: 0,
      nextMrr: 12,
      newBusinessMrr: 12,
      expansionMrr: 0,
      contractionMrr: 0,
      churnMrr: 0,
    })
  })

  it.concurrent('records paid upgrades as expansion MRR', () => {
    expect(classifyRevenueMovement(
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_solo_monthly',
        product_id: 'prod_solo',
        status: 'succeeded',
      },
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_team_monthly',
        product_id: 'prod_team',
        status: 'succeeded',
      },
      plans,
    )).toMatchObject({
      currentMrr: 12,
      nextMrr: 49,
      expansionMrr: 37,
      newBusinessMrr: 0,
      contractionMrr: 0,
      churnMrr: 0,
    })
  })

  it.concurrent('tracks monthly to yearly cadence upgrades for admin metrics even when MRR stays flat', () => {
    const movement = classifyRevenueMovement(
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_solo_monthly',
        product_id: 'prod_solo',
        status: 'succeeded',
      },
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_solo_yearly',
        product_id: 'prod_solo',
        status: 'succeeded',
      },
      plans,
    )

    expect(movement).toMatchObject({
      currentMrr: 12,
      nextMrr: 10,
      newBusinessMrr: 0,
      expansionMrr: 0,
      contractionMrr: 2,
      churnMrr: 0,
    })
    expect(shouldTrackOrganizationUpgrade(true, movement)).toBe(true)
  })

  it.concurrent('does not track first-time subscriptions as organization upgrades for admin metrics', () => {
    const movement = classifyRevenueMovement(
      {
        paid_at: null,
        price_id: null,
        product_id: null,
        status: 'created',
      },
      {
        is_good_plan: true,
        paid_at: '2026-04-22T12:00:00.000Z',
        price_id: 'price_solo_monthly',
        product_id: 'prod_solo',
        status: 'succeeded',
      },
      plans,
    )

    expect(shouldTrackOrganizationUpgrade(false, movement)).toBe(false)
  })

  it.concurrent('records downgrades as contraction MRR', () => {
    expect(classifyRevenueMovement(
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_team_monthly',
        product_id: 'prod_team',
        status: 'succeeded',
      },
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_solo_monthly',
        product_id: 'prod_solo',
        status: 'succeeded',
      },
      plans,
    )).toMatchObject({
      currentMrr: 49,
      nextMrr: 12,
      contractionMrr: 37,
      newBusinessMrr: 0,
      expansionMrr: 0,
      churnMrr: 0,
      lostPlan: 'team',
    })
  })

  it.concurrent('records cancellations as churned MRR', () => {
    expect(classifyRevenueMovement(
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_team_yearly',
        product_id: 'prod_team',
        status: 'succeeded',
      },
      {
        is_good_plan: true,
        paid_at: '2026-04-01T00:00:00.000Z',
        price_id: 'price_team_yearly',
        product_id: 'prod_team',
        status: 'canceled',
      },
      plans,
    )).toMatchObject({
      currentMrr: 39,
      nextMrr: 0,
      churnMrr: 39,
      newBusinessMrr: 0,
      expansionMrr: 0,
      contractionMrr: 0,
      lostPlan: 'team',
    })
  })

  it.concurrent('treats already-persisted newer subscription state as stale', () => {
    expect(isStaleStripeEvent(
      {
        last_stripe_event_at: '2026-04-22T12:10:00.000Z',
      },
      '2026-04-22T12:00:00.000Z',
    )).toBe(true)
  })

  it.concurrent('keeps newer incoming subscription events eligible for processing', () => {
    expect(isStaleStripeEvent(
      {
        last_stripe_event_at: '2026-04-22T12:10:00.000Z',
      },
      '2026-04-22T12:20:00.000Z',
    )).toBe(false)
  })
})
