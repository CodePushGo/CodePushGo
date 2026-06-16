export type Platform = 'ios' | 'android'

export interface AppTransferHistoryEntry {
  fromOrg: string | null
  toOrg: string
  transferredAt: string
}

export interface AppRecord {
  appId: string
  name: string
  ownerOrg?: string
  exposeMetadata?: boolean
  statsUpdatedAt?: string | null
  statsRefreshRequestedAt?: string | null
  transferHistory?: AppTransferHistoryEntry[]
  createdAt: string
}

export interface ReleaseManifestEntry {
  file_name?: string | null
  file_hash?: string | null
  s3_path?: string | null
}

export interface ReleaseRecord {
  appId: string
  version: string
  platform: Platform
  channel: string
  path: string
  checksum: string
  sessionKey?: string | null
  keyId?: string | null
  size: number
  mandatory: boolean
  rollout: number
  notes?: string
  minUpdateVersion?: string | null
  manifest?: ReleaseManifestEntry[]
  nativePackages?: Array<{ name: string, version: string, ios_checksum?: string, android_checksum?: string }>
  ownerOrg?: string
  createdAt: string
}

export interface ChannelRecord {
  id: string
  name: string
  public: boolean
  allowSelfSet: boolean
  ios?: boolean
  android?: boolean
  electron?: boolean
}

export interface DeviceRecord {
  appId: string
  deviceId: string
  platform?: Platform
  pluginVersion?: string
  osVersion?: string
  versionBuild?: string
  versionName?: string
  customId?: string
  keyId?: string
  isProd?: boolean
  isEmulator?: boolean
  defaultChannel?: string
  channel?: string
  updatedAt: string
}

export interface OrganizationRecord {
  id: string
  name: string
  managementEmail?: string
  website?: string
  passwordPolicyConfig?: Record<string, unknown> | null
  enforceEncryptedBundles?: boolean
  requiredEncryptionKey?: string | null
  statsUpdatedAt?: string | null
  lastStatsUpdatedAt?: string | null
  statsRefreshRequestedAt?: string | null
  createdBy?: string
  customerId?: string
  createdAt: string
}

export interface UserRecord {
  id: string
  email: string
  firstName?: string
  lastName?: string
  createdAt: string
  updatedAt: string
}

export interface SsoProviderRecord {
  providerId: string
  orgId: string
  domain?: string
  enabled: boolean
  enforceSso: boolean
  createdAt: string
}

export interface SsoProvisionInput {
  userId: string
  email: string
  firstName?: string
  lastName?: string
  providerId: string
  orgId?: string
}

export interface SsoProvisionResult {
  success: true
  merged: boolean
  alreadyMember: boolean
  orgId: string
  userId: string
}

export interface PendingInvitationRecord {
  inviteMagicString: string
  email: string
  firstName?: string
  lastName?: string
  futureUuid: string
  orgId: string
  role: string
  cancelledAt?: string | null
  createdAt: string
}

export interface CreatePendingInvitationInput {
  inviteMagicString: string
  email: string
  firstName?: string
  lastName?: string
  futureUuid: string
  orgId: string
  role: string
  cancelledAt?: string | null
}

export interface AcceptInvitationInput {
  magicInviteString: string
  optForNewsletters: boolean
}

export interface AcceptInvitationResult {
  success: true
  userId: string
  orgId: string
  role: string
}
export type ApiKeyScopeType = 'org' | 'app'

export interface ApiKeyBindingRecord {
  roleName: string
  scopeType: ApiKeyScopeType
  orgId?: string
  appId?: string
  reason?: string
}

export interface ApiKeyRecord {
  id: number
  name: string
  keyHash: string
  rbacId: string
  bindings: ApiKeyBindingRecord[]
  globalPermissions: string[]
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}
export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE'

export interface AuditLogRecord {
  id: number
  createdAt: string
  tableName: string
  recordId: string
  operation: AuditOperation
  userId: string | null
  orgId: string
  oldRecord: unknown
  newRecord: unknown
  changedFields: string[] | null
}



export interface UpdateRequest {
  app_id: string
  bundle_id?: string
  device_id: string
  platform: Platform
  version_name: string
  version_build?: string
  plugin_version?: string
  channel?: string
  defaultChannel?: string
  default_channel?: string
  custom_id?: string
  key_id?: string
}

export interface UpdateAvailableResponse {
  status: 'ok'
  available: true
  version: string
  url: string
  checksum: string
  size: number
  channel: string
  mandatory: boolean
  rollout: number
  message?: string
}

export interface NoUpdateResponse {
  status: 'ok'
  available: false
  error?: string
  kind?: 'up_to_date' | 'blocked' | 'failed'
  message: string
}

export type UpdateResponse = UpdateAvailableResponse | NoUpdateResponse

export type StatsAction =
  | 'app_ready'
  | 'download_start'
  | 'download_complete'
  | 'download_fail'
  | 'download_manifest_start'
  | 'download_manifest_complete'
  | 'download_zip_start'
  | 'download_zip_complete'
  | 'download_manifest_file_fail'
  | 'download_manifest_checksum_fail'
  | 'download_manifest_brotli_fail'
  | 'install_start'
  | 'install_complete'
  | 'install_fail'
  | 'rollback'
  | 'backend_refusal'
  | 'app_crash'
  | 'app_crash_native'
  | 'app_anr'
  | 'app_killed_low_memory'
  | 'app_killed_excessive_resource_usage'
  | 'app_initialization_failure'
  | 'app_memory_warning'
  | 'webview_javascript_error'
  | 'webview_unhandled_rejection'
  | 'webview_resource_error'
  | 'webview_security_policy_violation'
  | 'webview_unclean_restart'
  | 'webview_render_process_gone'
  | 'webview_content_process_terminated'
  | 'os_version_changed'
  | 'native_app_version_changed'

export interface StatsEvent {
  app_id: string
  bundle_id?: string
  device_id: string
  platform: Platform
  version_name: string
  version_build?: string
  version_os?: string
  action: StatsAction
  key_id?: string
  plugin_version?: string
  custom_id?: string
  is_prod?: boolean
  is_emulator?: boolean
  defaultChannel?: string
  default_channel?: string
  metadata?: Record<string, unknown>
}

export interface ConsoleEvent {
  channel: string
  event: string
  description?: string
  icon?: string
  notify?: boolean
  notifyConsole?: boolean
  orgId?: string
  userId?: string
  trackingVersion?: number
  tags?: Record<string, unknown>
  createdAt: string
}

export interface ApiErrorResponse {
  error: string
  message: string
}

export interface OkResponse {
  status: 'ok'
}
