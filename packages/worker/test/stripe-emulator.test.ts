import { describe, expect, it } from 'vitest'
import { buildCheckoutMetadata, buildOneTimeCheckoutLineItem, getCreditCheckoutDetailsFromMetadata, resolveStripeRedirectUrl } from '../src/stripe'

describe('[Capgo parity] stripe emulator integration helpers', () => {
  it('falls back to checkout metadata when emulator line item reads are unavailable', () => {
    const details = getCreditCheckoutDetailsFromMetadata({
      metadata: {
        productId: 'prod_credit_123',
        intendedQuantity: '75',
      },
    }, 'prod_credit_123')

    expect(details).toEqual({
      creditQuantity: 75,
      itemsSummary: [{ id: null, quantity: 75, priceId: null, productId: 'prod_credit_123' }],
    })
  })

  it('disables adjustable quantity for emulator-backed one-time checkout sessions', () => {
    expect(buildOneTimeCheckoutLineItem('price_123', 5, true)).toEqual({ price: 'price_123', quantity: 5 })
    expect(buildCheckoutMetadata('org_123', null, { visitorId: 'visitor_456', sessionId: 'session_456' }, 5, 'prod_123')).toMatchObject({
      datafast_session_id: 'session_456',
      datafast_visitor_id: 'visitor_456',
      intendedQuantity: '5',
      orgId: 'org_123',
      productId: 'prod_123',
    })
  })

  it('keeps checkout redirects pinned to the configured webapp origin', () => {
    expect(resolveStripeRedirectUrl('https://codepushgo.test', '/settings/organization/plans', true)).toBe('https://codepushgo.test/settings/organization/plans?success=true')
    expect(() => resolveStripeRedirectUrl('https://codepushgo.test', 'https://example.com/phishing', true)).toThrow('Invalid redirect URL')
  })
})
