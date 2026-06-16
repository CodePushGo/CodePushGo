import { describe, expect, it } from 'vitest'
import { getInviteResendRequiredPermission } from '../src/invites'

describe('[Capgo parity] getInviteResendRequiredPermission', () => {
  it.concurrent('requires org.invite_user for non-super-admin invite resends', () => {
    expect(getInviteResendRequiredPermission('invite_read', false, true)).toBe('org.invite_user')
  })

  it.concurrent('requires org.update_user_roles for super-admin invite resends', () => {
    expect(getInviteResendRequiredPermission('invite_super_admin', true, false)).toBe('org.update_user_roles')
  })

  it.concurrent('allows resend when the caller has the needed permission', () => {
    expect(getInviteResendRequiredPermission('invite_read', true, false)).toBeNull()
    expect(getInviteResendRequiredPermission('invite_super_admin', true, true)).toBeNull()
  })
})
