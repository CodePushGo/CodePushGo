export type NativeBuildPlatform = 'ios' | 'android' | 'macos'

export interface NativeBuildScopeStatus {
  platform: NativeBuildPlatform
  enabled: false
  reason: string
}

export const nativeBuildDisabledReason = 'Native cloud build and store automation are intentionally out of scope for the React Native CodePushGo MVP.'

export function nativeBuildSupportStatus(platform: NativeBuildPlatform): NativeBuildScopeStatus {
  return { platform, enabled: false, reason: nativeBuildDisabledReason }
}

export function assertNativeBuildDisabled(platform: NativeBuildPlatform, flow: string) {
  const status = nativeBuildSupportStatus(platform)
  if (!status.enabled)
    throw new Error(`${flow} is disabled. ${status.reason}`)
}

export function isNativeBuildFlowEnabled() {
  return false
}

export function nativeFlowFallback(platform: NativeBuildPlatform, flow: string) {
  return {
    status: 'disabled' as const,
    platform,
    flow,
    message: nativeBuildDisabledReason,
  }
}
