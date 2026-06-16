export function isPlatformAdminSecretValue(secretValue: unknown, userId: string | null | undefined) {
  if (!userId)
    return false
  if (Array.isArray(secretValue))
    return secretValue.some(value => value === userId)
  if (secretValue && typeof secretValue === 'object')
    return Object.prototype.hasOwnProperty.call(secretValue, userId)
  return false
}
