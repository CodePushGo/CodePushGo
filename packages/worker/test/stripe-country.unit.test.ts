import { describe, expect, it } from 'vitest'
import { extractStripeDataEvent, isStripeCustomerProfileEvent, normalizeStripeCountryCode } from '../src/stripe'

describe('stripe customer country sync', () => {
  it.concurrent('normalizes Stripe country codes to ISO alpha-2 uppercase', () => {
    expect(normalizeStripeCountryCode('it')).toBe('IT')
    expect(normalizeStripeCountryCode(' us ')).toBe('US')
  })

  it.concurrent('returns null for empty or invalid Stripe country codes', () => {
    expect(normalizeStripeCountryCode('')).toBeNull()
    expect(normalizeStripeCountryCode('   ')).toBeNull()
    expect(normalizeStripeCountryCode('gbr')).toBeNull()
    expect(normalizeStripeCountryCode('1@')).toBeNull()
    expect(normalizeStripeCountryCode(null)).toBeNull()
    expect(normalizeStripeCountryCode(undefined)).toBeNull()
  })

  it.concurrent('extracts the customer id from customer.updated events', () => {
    const event = {
      created: 1_711_925_200,
      data: {
        object: {
          id: 'cus_country_sync',
          object: 'customer',
        },
      },
      type: 'customer.updated',
    }

    const stripeData = extractStripeDataEvent(event)

    expect(stripeData.data.customer_id).toBe('cus_country_sync')
    expect(stripeData.data.status).toBe('updated')
    expect(isStripeCustomerProfileEvent(event)).toBe(true)
  })

  it.concurrent('treats non-customer profile events as the normal subscription flow', () => {
    const event = {
      type: 'customer.subscription.updated',
    }

    expect(isStripeCustomerProfileEvent(event)).toBe(false)
  })
})
