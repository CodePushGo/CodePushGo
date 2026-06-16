export type ExistingUserInviteResult = 'OK' | 'ALREADY_INVITED' | 'NO_EMAIL' | 'CAN_NOT_INVITE_OWNER' | string
export type InviteResendPermission = 'org.invite_user' | 'org.update_user_roles'

export function shouldAttemptExistingUserInviteNotification(result: ExistingUserInviteResult, resendPendingInvite = false) {
  if (result === 'OK')
    return true
  if (result === 'ALREADY_INVITED')
    return resendPendingInvite
  return false
}

export function getInviteResendRequiredPermission(inviteType: string, canInviteUsers: boolean, canUpdateUserRoles: boolean): InviteResendPermission | null {
  if (inviteType === 'invite_super_admin')
    return canUpdateUserRoles ? null : 'org.update_user_roles'
  return canInviteUsers ? null : 'org.invite_user'
}
