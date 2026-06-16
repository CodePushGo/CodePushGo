import { describe, expect, it, vi } from 'vitest'
import { OrganizationStripeSyncError, sanitizeOrganizationName, syncOrganizationNameToStripeAfterCommit } from '../src/organization-stripe-sync'
import { authHeaders, testApp } from './helpers'

const previous = {
  id: 'org-123',
  name: 'Old Name',
  managementEmail: 'billing@example.com',
  customerId: 'cus_123',
  createdAt: '2026-04-15T12:00:00Z',
}

const committed = {
  ...previous,
  name: 'New Name',
  createdAt: '2026-04-15T13:00:00Z',
}

describe('[Capgo parity] organization put Stripe sync', () => {
  it('sanitizes organization names before commit', () => {
    expect(sanitizeOrganizationName('  <b>New Name</b>  ')).toBe('New Name')
    expect(sanitizeOrganizationName('<b></b>')).toBe('')
  })

  it('updates the committed Stripe customer name after the org row is updated', async () => {
    const updateCustomerOrganizationName = vi.fn().mockResolvedValue(undefined)

    await syncOrganizationNameToStripeAfterCommit(previous, committed, { updateCustomerOrganizationName })

    expect(updateCustomerOrganizationName).toHaveBeenCalledWith('cus_123', 'New Name')
  })

  it('skips Stripe sync for pending customer ids', async () => {
    const updateCustomerOrganizationName = vi.fn().mockResolvedValue(undefined)

    await syncOrganizationNameToStripeAfterCommit(previous, { ...committed, customerId: 'pending_org-123' }, { updateCustomerOrganizationName })

    expect(updateCustomerOrganizationName).not.toHaveBeenCalled()
  })

  it('keeps the org row when Stripe already persisted the renamed customer name', async () => {
    const updateCustomerOrganizationName = vi.fn().mockRejectedValue(new Error('connection reset'))
    const getStripeCustomerName = vi.fn().mockResolvedValue('New Name')
    const rollbackOrganization = vi.fn()

    await syncOrganizationNameToStripeAfterCommit(previous, committed, { updateCustomerOrganizationName, getStripeCustomerName, rollbackOrganization })

    expect(getStripeCustomerName).toHaveBeenCalledWith('cus_123')
    expect(rollbackOrganization).not.toHaveBeenCalled()
  })

  it('rolls the org row back when deterministic Stripe sync fails', async () => {
    const updateCustomerOrganizationName = vi.fn().mockRejectedValue(new Error('Stripe update failed'))
    const getStripeCustomerName = vi.fn().mockResolvedValue('Old Name')
    const rollbackOrganization = vi.fn().mockResolvedValue(previous)

    const error = await syncOrganizationNameToStripeAfterCommit(previous, committed, {
      updateCustomerOrganizationName,
      getStripeCustomerName,
      rollbackOrganization,
      isDeterministicStripeCustomerUpdateError: () => true,
    }).catch(caught => caught)

    expect(error).toBeInstanceOf(OrganizationStripeSyncError)
    expect(rollbackOrganization).toHaveBeenCalledWith({ orgId: 'org-123', name: 'Old Name', managementEmail: 'billing@example.com', customerId: 'cus_123' })
    expect(error.moreInfo).toMatchObject({ error: 'Stripe update failed' })
  })

  it('does not roll back when Stripe state is unknown after a transport failure', async () => {
    const updateCustomerOrganizationName = vi.fn().mockRejectedValue(new Error('connection reset'))
    const getStripeCustomerName = vi.fn().mockResolvedValue(undefined)
    const rollbackOrganization = vi.fn()

    const error = await syncOrganizationNameToStripeAfterCommit(previous, committed, {
      updateCustomerOrganizationName,
      getStripeCustomerName,
      rollbackOrganization,
      isDeterministicStripeCustomerUpdateError: () => false,
    }).catch(caught => caught)

    expect(error).toBeInstanceOf(OrganizationStripeSyncError)
    expect(rollbackOrganization).not.toHaveBeenCalled()
    expect(error.moreInfo).toMatchObject({ error: 'connection reset', stripeSyncState: 'unknown' })
  })

  it('rejects blank names in PUT /organization after HTML stripping', async () => {
    const { app, env, storage } = testApp()
    const orgId = crypto.randomUUID()
    await storage.upsertOrganization({ id: orgId, name: 'Old Name' })

    const response = await app.request('https://api.test/organization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ orgId, name: '<b></b>' }),
    }, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'sanitized_name_empty' })
    await expect(storage.getOrganization(orgId)).resolves.toMatchObject({ name: 'Old Name' })
  })
})
