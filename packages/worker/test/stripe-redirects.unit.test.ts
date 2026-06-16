import { describe, expect, it } from 'vitest'
import {
  buildCheckoutMetadata,
  buildOneTimeCheckoutLineItem,
  buildStripeCustomerEmailUpdate,
  buildStripeCustomerOrganizationNameUpdate,
  getCreditCheckoutDetailsFromMetadata,
  isDeterministicStripeCustomerUpdateError,
  resolveStripeRedirectUrl,
} from '../src/stripe'

const webappUrl = 'https://codepushgo.test'

describe('stripe redirect URL allowlist', () => {
  it('allows same-origin return URLs for billing portal', () => {
    expect(resolveStripeRedirectUrl(webappUrl, '/app/usage')).toBe('https://codepushgo.test/app/usage')
  })

  it('rejects external return URLs for billing portal', () => {
    expect(() => resolveStripeRedirectUrl(webappUrl, 'https://example.com/phishing')).toThrow('Invalid redirect URL')
    try {
      resolveStripeRedirectUrl(webappUrl, 'https://example.com/phishing')
    }
    catch (error) {
      expect(error).toMatchObject({ status: 400, cause: { error: 'invalid_redirect_url' } })
    }
  })

  it('allows same-origin success and cancel URLs for checkout', () => {
    expect(resolveStripeRedirectUrl(webappUrl, '/app/success', true)).toBe('https://codepushgo.test/app/success?success=true')
    expect(resolveStripeRedirectUrl(webappUrl, '/app/cancel')).toBe('https://codepushgo.test/app/cancel')
    expect(buildCheckoutMetadata('org_123', 'legacy_visitor_123', {
      visitorId: 'visitor_123',
      sessionId: 'session_123',
    })).toEqual({
      orgId: 'org_123',
      attribution_id: 'legacy_visitor_123',
      datafast_visitor_id: 'visitor_123',
      datafast_session_id: 'session_123',
    })
  })

  it('rejects external success URLs for checkout', () => {
    expect(() => resolveStripeRedirectUrl(webappUrl, 'https://example.com/phishing', true)).toThrow('Invalid redirect URL')
  })

  it('rejects external cancel URLs for one-time checkout', () => {
    expect(() => resolveStripeRedirectUrl(webappUrl, 'https://example.com/phishing')).toThrow('Invalid redirect URL')
  })

  it('falls back to checkout metadata for credit top-ups when line items are unavailable in emulator mode', () => {
    const details = getCreditCheckoutDetailsFromMetadata({
      metadata: {
        productId: 'prod_credit_123',
        intendedQuantity: '75',
      },
    }, 'prod_credit_123')

    expect(details).toEqual({
      creditQuantity: 75,
      itemsSummary: [
        {
          id: null,
          quantity: 75,
          priceId: null,
          productId: 'prod_credit_123',
        },
      ],
    })
  })

  it('disables adjustable quantity for emulator-backed one-time checkout sessions', () => {
    expect(buildOneTimeCheckoutLineItem('price_123', 5, true)).toEqual({
      price: 'price_123',
      quantity: 5,
    })
    expect(buildCheckoutMetadata('org_123', null, {
      visitorId: 'visitor_456',
      sessionId: 'session_456',
    }, 5, 'prod_123')).toEqual({
      datafast_session_id: 'session_456',
      datafast_visitor_id: 'visitor_456',
      intendedQuantity: '5',
      orgId: 'org_123',
      productId: 'prod_123',
    })
  })

  it('updates Stripe customer email without overwriting the organization name', () => {
    expect(buildStripeCustomerEmailUpdate('billing@codepushgo.app')).toEqual({
      email: 'billing@codepushgo.app',
      metadata: {
        email: 'billing@codepushgo.app',
      },
    })
  })

  it('updates Stripe customer name when the organization name changes', () => {
    expect(buildStripeCustomerOrganizationNameUpdate('CodePushGo Org')).toEqual({
      name: 'CodePushGo Org',
    })
  })

  it('treats Stripe rate-limit errors as deterministic customer update failures', () => {
    const rateLimitError = Object.assign(new Error('rate limited'), { name: 'StripeRateLimitError' })

    expect(isDeterministicStripeCustomerUpdateError(rateLimitError)).toBe(true)
  })
})
