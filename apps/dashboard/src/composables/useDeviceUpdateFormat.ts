export interface DashboardDeviceRow {
  app_id?: string | null
  custom_id?: string | null
  default_channel?: string | null
  device_id: string
  is_emulator?: boolean | null
  is_prod?: boolean | null
  os_version?: string | null
  platform?: string | null
  plugin_version?: string | null
  updated_at?: string | null
  version?: string | null
  version_build?: string | null
  version_name?: string | null
}

export interface DeviceUpdateRequestPayload {
  app_id: string
  device_id: string
  platform?: string
  plugin_version?: string
  version_build?: string
  version_name?: string
  version_os?: string
  custom_id?: string
  is_emulator?: boolean
  is_prod?: boolean
  defaultChannel: string
  channel?: string
}

function maybeString(value: string | null | undefined) {
  return value && value.length > 0 ? value : undefined
}

function maybeBoolean(value: boolean | null | undefined) {
  return typeof value === 'boolean' ? value : undefined
}

export function transformDeviceToUpdateRequest(device: DashboardDeviceRow, appId: string, defaultChannel: string, channel?: string | null): DeviceUpdateRequestPayload {
  const request: DeviceUpdateRequestPayload = {
    app_id: appId,
    device_id: device.device_id,
    defaultChannel,
  }

  const platform = maybeString(device.platform)
  if (platform)
    request.platform = platform
  const pluginVersion = maybeString(device.plugin_version)
  if (pluginVersion)
    request.plugin_version = pluginVersion
  const versionBuild = maybeString(device.version_build)
  if (versionBuild)
    request.version_build = versionBuild
  const versionName = maybeString(device.version_name)
  if (versionName)
    request.version_name = versionName
  const osVersion = maybeString(device.os_version)
  if (osVersion)
    request.version_os = osVersion
  const customId = maybeString(device.custom_id)
  if (customId)
    request.custom_id = customId
  const isEmulator = maybeBoolean(device.is_emulator)
  if (isEmulator !== undefined)
    request.is_emulator = isEmulator
  const isProd = maybeBoolean(device.is_prod)
  if (isProd !== undefined)
    request.is_prod = isProd
  const overrideChannel = maybeString(channel)
  if (overrideChannel)
    request.channel = overrideChannel

  return request
}

export function useDeviceUpdateFormat() {
  return {
    transformDeviceToUpdateRequest,
  }
}
