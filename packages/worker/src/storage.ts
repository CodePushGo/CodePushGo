import type { AcceptInvitationInput, AcceptInvitationResult, ApiKeyBindingRecord, ApiKeyRecord, AppRecord, AppTransferHistoryEntry, AuditLogRecord, AuditOperation, ChannelRecord, ConsoleEvent, CreatePendingInvitationInput, DeviceRecord, OrganizationRecord, PendingInvitationRecord, Platform, ReleaseManifestEntry, ReleaseRecord, SsoProviderRecord, SsoProvisionInput, SsoProvisionResult, StatsEvent, UserRecord } from '@codepushgo/shared'
import type { CompatibilityEventRecord, StoredCompatibilityEvent } from './compatibility-events'
import type { WebhookDeliveryVersion } from './webhook-delivery-security'
import { compareVersions } from '@codepushgo/shared'
import { findMatchingUsageOverageEvent, shouldCreateUsageOverageEvent } from './overage-tracking'

export interface ChannelSelfKVNamespace {
  get(key: string, options?: { type?: 'json' | 'text' }): Promise<unknown>
  put(key: string, value: string): Promise<unknown>
  delete(key: string): Promise<unknown>
}

export interface Env {
  DB?: D1Database
  BUNDLES?: R2Bucket
  CHANNEL_SELF_STORE?: ChannelSelfKVNamespace
  CODEPUSHGO_API_KEY?: string
  API_SECRET?: string
  CODEPUSHGO_ADMIN_API_KEY?: string
  CODEPUSHGO_ENV?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_BUNDLE_BUCKET?: string
  MAIN_SUPABASE_DB_URL?: string
  SUPABASE_DB_DIRECT_URL?: string
  HYPERDRIVE_CAPGO_DIRECT_EU?: { connectionString: string }
  GOOGLE_OAUTH_CLIENT_ID?: string
  GOOGLE_OAUTH_CLIENT_SECRET?: string
  GOOGLE_OAUTH_SCOPES?: string
  BUILDER_URL?: string
  BUILDER_API_KEY?: string
  JWT_SECRET?: string
  PUBLIC_URL?: string
  POSTHOG_API_KEY?: string
  POSTHOG_API_HOST?: string
  RATE_LIMIT_UPDATE_ENUMERATION_HASH_SECRET?: string
  RATE_LIMIT_UPDATE_ENUMERATION_MISSES?: string
  ENV_NAME?: string
}

export interface CreateReleaseInput {
  appId: string
  version: string
  platform: Platform
  channel: string
  bytes: ArrayBuffer
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
}

export interface BundleObject {
  body: ReadableStream<Uint8Array> | null
  contentType: string
  size: number
  checksum: string
}

export interface VersionMetaRecord {
  appId: string
  versionId: number
  size: number
  createdAt: string
}

export interface UpsertVersionMetaInput {
  appId: string
  versionId: number
  size: number
}

export interface UpsertChannelInput {
  appId: string
  name: string
  public?: boolean
  allowSelfSet?: boolean
  ios?: boolean
  android?: boolean
  electron?: boolean
}

export interface UpsertDeviceInput {
  appId: string
  deviceId: string
  platform?: Platform
  pluginVersion?: string
  osVersion?: string
  versionBuild?: string
  versionName?: string
  customId?: string
  isProd?: boolean
  keyId?: string
  isEmulator?: boolean
  defaultChannel?: string | null
  channel?: string
}
export type RoleBindingPrincipalType = 'user' | 'group' | 'apikey'
export type RoleBindingScopeType = 'org' | 'app' | 'channel'

export interface RoleBindingRecord {
  id: string
  principalType: RoleBindingPrincipalType
  principalId: string
  roleName: string
  scopeType: RoleBindingScopeType
  orgId: string
  appId?: string | null
  channelId?: string | null
  reason?: string | null
  isDirect: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateRoleBindingInput {
  principalType: RoleBindingPrincipalType
  principalId: string
  roleName: string
  scopeType: RoleBindingScopeType
  orgId: string
  appId?: string | null
  channelId?: string | number | null
  reason?: string | null
}

export interface UpdateRoleBindingInput {
  roleName: string
}

export interface ChannelPermissionOverrideRecord {
  principalType: RoleBindingPrincipalType
  principalId: string
  channelId: string
  permissionKey: string
  isAllowed: boolean
}

export interface CreateApiKeyInput {
  name: string
  keyHash: string
  bindings: ApiKeyBindingRecord[]
  globalPermissions?: string[]
  expiresAt?: string | null
}

export interface UpdateApiKeyInput {
  name?: string
  keyHash?: string
  bindings?: ApiKeyBindingRecord[]
  globalPermissions?: string[]
  expiresAt?: string | null
}
export interface CreateAuditLogInput {
  tableName: string
  recordId: string
  operation: AuditOperation
  userId?: string | null
  orgId: string
  oldRecord?: unknown
  newRecord?: unknown
  changedFields?: string[] | null
}

export interface ListAuditLogsQuery {
  orgId: string
  tableName?: string
  operation?: AuditOperation
  page: number
  limit: number
}

export interface ListAuditLogsResult {
  data: AuditLogRecord[]
  total: number
  page: number
  limit: number
}
export interface OrgMembershipRecord {
  userId: string
  orgId: string
  role: string
  createdAt: string
}

export interface OrgMemberRecord extends OrgMembershipRecord {
  email: string
}

export interface UpsertOrganizationInput {
  id: string
  name: string
  managementEmail?: string | null
  createdBy?: string | null
  customerId?: string | null
  passwordPolicyConfig?: Record<string, unknown> | null
  enforceEncryptedBundles?: boolean
  requiredEncryptionKey?: string | null
  website?: string | null
}

export interface UsageCreditGrantRecord {
  id: string
  orgId: string
  amount: number
  notes?: string
  createdBy?: string | null
  createdAt: string
}

export interface BuildRequestRecord {
  id: string
  appId: string
  ownerOrg: string
  requestedBy: string
  platform: Platform
  buildMode: string
  status: string
  builderJobId: string
  createdAt: string
  updatedAt: string
}

export interface BuildLogRecord {
  buildId: string
  orgId: string
  userId: string
  appId: string
  platform: Platform
  buildTimeUnit: number
  billableSeconds: number
  createdAt: string
  updatedAt: string
}

export interface RecordBuildTimeInput {
  orgId: string
  userId: string
  buildId: string
  platform: Platform
  buildTimeUnit: number
  appId: string
}

export interface BuildTimeMetricsRecord {
  appId: string
  date: string
  buildTimeUnit: number
  buildCount: number
}

export interface MauMetricsRecord {
  appId: string
  date: string
  mau: number
}

export type UsageCreditMetric = 'mau' | 'bandwidth' | 'storage' | 'build_time'

export interface UsageOverageEventRecord {
  id: string
  orgId: string
  metric: UsageCreditMetric
  overageAmount: number
  creditsConsumed: number
  details: Record<string, unknown>
  createdAt: string
}

export interface StripeInfoRecord {
  customerId: string
  status?: string | null
  planCalculatedAt?: string | null
  isGoodPlan?: boolean | null
}

export interface CreateBuildRequestInput {
  id?: string
  appId: string
  ownerOrg: string
  requestedBy: string
  platform: Platform
  buildMode: string
  status?: string
  builderJobId: string
}

export interface CreateCompatibilityEventInput extends CompatibilityEventRecord {}

export interface AcknowledgeCompatibilityEventInput {
  id: number
  note: string
  resolvedBy?: string | null
}

export interface UsageCreditBalanceRecord {
  orgId: string
  totalCredits: number
  usedCredits: number
  availableCredits: number
}

export interface GrantUsageCreditsInput {
  orgId: string
  amount: number
  notes?: string
  createdBy?: string | null
}

export interface ConsumeUsageCreditsInput {
  orgId: string
  amount: number
  reason?: string
  metric?: UsageCreditMetric
  overageAmount?: number
  details?: Record<string, unknown>
}

export interface RecordMauUsageInput {
  appId: string
  date: string
  mau: number
}

export interface UpsertStripeInfoInput {
  customerId: string
  status?: string | null
  planCalculatedAt?: string | null
  isGoodPlan?: boolean | null
}

export interface WebhookRecord {
  id: string
  orgId: string
  name: string
  url: string
  secret?: string
  enabled: boolean
  events: string[]
  deliveryVersion: WebhookDeliveryVersion
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateWebhookInput {
  orgId: string
  name: string
  url: string
  events: string[]
  enabled?: boolean
  deliveryVersion: WebhookDeliveryVersion
  createdBy?: string | null
}

export interface UpdateWebhookInput {
  name?: string
  url?: string
  events?: string[]
  enabled?: boolean
  deliveryVersion?: WebhookDeliveryVersion
}

export interface WebhookStatsRecord {
  success: number
  failed: number
  pending: number
}

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed'

export interface WebhookDeliveryRecord {
  id: string
  webhookId: string
  orgId: string
  auditLogId?: string | null
  eventType: string
  status: WebhookDeliveryStatus
  requestPayload: Record<string, unknown>
  responseStatus?: number | null
  responseBody?: string | null
  responseHeaders?: Record<string, unknown> | null
  attemptCount: number
  maxAttempts: number
  nextRetryAt?: string | null
  createdAt: string
  completedAt?: string | null
  durationMs?: number | null
  deliveryVersion: WebhookDeliveryVersion
}

export interface CreateWebhookDeliveryInput {
  id?: string
  webhookId: string
  orgId: string
  auditLogId?: string | null
  eventType: string
  requestPayload: Record<string, unknown>
  deliveryVersion: WebhookDeliveryVersion
  status?: WebhookDeliveryStatus
  responseStatus?: number | null
  responseBody?: string | null
  responseHeaders?: Record<string, unknown> | null
  attemptCount?: number
  maxAttempts?: number
}

export interface UpdateWebhookDeliveryInput {
  status?: WebhookDeliveryStatus
  responseStatus?: number | null
  responseBody?: string | null
  responseHeaders?: Record<string, unknown> | null
  attemptCount?: number
  nextRetryAt?: string | null
  completedAt?: string | null
  durationMs?: number | null
}

export interface ListWebhookDeliveriesQuery {
  webhookId: string
  status?: WebhookDeliveryStatus
  page: number
  perPage: number
}

export interface ListWebhookDeliveriesResult {
  deliveries: WebhookDeliveryRecord[]
  total: number
}


export interface StorageDriver {
  createApp(appId: string, name: string, ownerOrg?: string): Promise<AppRecord>
  updateApp(appId: string, input: { name?: string, exposeMetadata?: boolean }): Promise<AppRecord | undefined>
  getApp(appId: string): Promise<AppRecord | undefined>
  listApps(): Promise<AppRecord[]>
  transferApp(appId: string, newOwnerOrg: string): Promise<AppRecord | undefined>
  deleteApp(appId: string): Promise<boolean>
  listApiKeys(): Promise<ApiKeyRecord[]>
  getSsoProvider(providerId: string): Promise<SsoProviderRecord | undefined>
  upsertSsoProvider(provider: Pick<SsoProviderRecord, 'providerId' | 'orgId'> & Partial<SsoProviderRecord>): Promise<SsoProviderRecord>
  provisionSsoUser(input: SsoProvisionInput): Promise<SsoProvisionResult | undefined>
  getUserByEmail(email: string): Promise<UserRecord | undefined>
  getUser(userId: string): Promise<UserRecord | undefined>
  getOrgMembership(userId: string, orgId: string): Promise<OrgMembershipRecord | undefined>
  upsertOrganization(input: UpsertOrganizationInput): Promise<OrganizationRecord>
  searchOrganizations(query: string, limit?: number): Promise<OrganizationRecord[]>
  getUsageCreditBalance(orgId: string): Promise<UsageCreditBalanceRecord | undefined>
  grantUsageCredits(input: GrantUsageCreditsInput): Promise<{ org: OrganizationRecord, grant: UsageCreditGrantRecord, balance: UsageCreditBalanceRecord } | undefined>
  consumeUsageCredits(input: ConsumeUsageCreditsInput): Promise<{ balance: UsageCreditBalanceRecord, overageEvent?: UsageOverageEventRecord } | undefined>
  listUsageCreditGrants(limit?: number): Promise<UsageCreditGrantRecord[]>
  listUsageOverageEvents(orgId: string): Promise<UsageOverageEventRecord[]>
  listOrgMemberships(orgId: string): Promise<OrgMemberRecord[]>
  upsertOrgMembership(input: { orgId: string, userId: string, email: string, role: string }): Promise<OrgMemberRecord>
  deleteOrgMembershipByEmail(orgId: string, email: string): Promise<boolean>
  createRoleBinding(input: CreateRoleBindingInput): Promise<RoleBindingRecord | undefined>
  getRoleBinding(id: string): Promise<RoleBindingRecord | undefined>
  updateRoleBinding(id: string, input: UpdateRoleBindingInput): Promise<RoleBindingRecord | undefined>
  deleteRoleBinding(id: string): Promise<boolean>
  listRoleBindingsForAppScope(appId: string, scopeType?: RoleBindingScopeType): Promise<RoleBindingRecord[]>
  upsertChannelPermissionOverride(input: ChannelPermissionOverrideRecord): Promise<ChannelPermissionOverrideRecord>
  listChannelPermissionOverrides(principalType: RoleBindingPrincipalType, principalId: string): Promise<ChannelPermissionOverrideRecord[]>
  getOrganization(orgId: string): Promise<OrganizationRecord | undefined>
  listOrganizations(): Promise<OrganizationRecord[]>
  deleteOrganization(orgId: string): Promise<boolean>
  upsertStripeInfo(input: UpsertStripeInfoInput): Promise<StripeInfoRecord>
  getStripeInfoByCustomerId(customerId: string): Promise<StripeInfoRecord | undefined>
  markAppStatsRefreshed(appId: string, refreshedAt?: string): Promise<AppRecord | undefined>
  markOrgStatsRefreshed(orgId: string, refreshedAt?: string): Promise<OrganizationRecord | undefined>
  markStripePlanCalculated(customerId: string, calculatedAt?: string): Promise<StripeInfoRecord | undefined>
  createPendingInvitation(input: CreatePendingInvitationInput): Promise<PendingInvitationRecord>
  getPendingInvitation(inviteMagicString: string): Promise<PendingInvitationRecord | undefined>
  acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult | undefined>
  getApiKey(id: number): Promise<ApiKeyRecord | undefined>
  getApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | undefined>
  createApiKey(input: CreateApiKeyInput): Promise<ApiKeyRecord>
  updateApiKey(id: number, input: UpdateApiKeyInput): Promise<ApiKeyRecord | undefined>
  createBuildRequest(input: CreateBuildRequestInput): Promise<BuildRequestRecord>
  getBuildRequestByJobId(jobId: string): Promise<BuildRequestRecord | undefined>
  updateBuildRequestStatus(jobId: string, status: string): Promise<BuildRequestRecord | undefined>
  deleteApiKey(id: number): Promise<boolean>
  recordAuditLog(input: CreateAuditLogInput): Promise<AuditLogRecord>
  listAuditLogs(query: ListAuditLogsQuery): Promise<ListAuditLogsResult>
  createRelease(input: CreateReleaseInput): Promise<ReleaseRecord>
  listReleases(appId: string): Promise<ReleaseRecord[]>
  upsertVersionMeta(input: UpsertVersionMetaInput): Promise<boolean>
  recordBuildTime(input: RecordBuildTimeInput): Promise<BuildLogRecord>
  createCompatibilityEvent(input: CreateCompatibilityEventInput): Promise<StoredCompatibilityEvent>
  getCompatibilityEvent(id: number): Promise<StoredCompatibilityEvent | undefined>
  listCompatibilityEvents(appId: string): Promise<StoredCompatibilityEvent[]>
  acknowledgeCompatibilityEvent(input: AcknowledgeCompatibilityEventInput): Promise<StoredCompatibilityEvent | undefined>
  listBuildLogsByOrg(orgId: string): Promise<BuildLogRecord[]>
  getDailyBuildTime(appId: string, date: string): Promise<BuildTimeMetricsRecord | undefined>
  listDailyBuildTimeByOrg(orgId: string): Promise<BuildTimeMetricsRecord[]>
  recordMauUsage(input: RecordMauUsageInput): Promise<MauMetricsRecord>
  listDailyMauByOrg(orgId: string): Promise<MauMetricsRecord[]>
  listReleases(appId: string): Promise<ReleaseRecord[]>
  deleteReleases(appId: string, version?: string): Promise<boolean>
  listChannels(appId: string, platform?: Platform): Promise<ChannelRecord[]>
  upsertChannel(input: UpsertChannelInput): Promise<ChannelRecord>
  deleteChannel(appId: string, channel: string): Promise<boolean>
  getRelease(appId: string, platform: Platform, channel: string, version: string): Promise<ReleaseRecord | undefined>
  findLatestRelease(appId: string, platform: Platform, channel: string): Promise<ReleaseRecord | undefined>
  getBundle(release: ReleaseRecord): Promise<BundleObject | undefined>
  listDevices(appId: string): Promise<DeviceRecord[]>
  getDevice(appId: string, deviceId: string): Promise<DeviceRecord | undefined>
  upsertDevice(input: UpsertDeviceInput): Promise<DeviceRecord>
  deleteDevice(appId: string, deviceId: string): Promise<boolean>
  getDeviceChannel(appId: string, deviceId: string): Promise<string | undefined>
  setDeviceChannel(appId: string, deviceId: string, channel: string): Promise<void>
  clearDeviceChannel(appId: string, deviceId: string): Promise<void>
  recordStats(event: StatsEvent): Promise<void>
  listStatsEvents(query: ListStatsEventsQuery): Promise<StatsEventRecord[]>
  recordEvent(event: ConsoleEvent): Promise<void>
  createWebhook(input: CreateWebhookInput): Promise<WebhookRecord>
  getWebhook(webhookId: string): Promise<WebhookRecord | undefined>
  listWebhooks(orgId: string, page: number, perPage: number): Promise<WebhookRecord[]>
  updateWebhook(webhookId: string, input: UpdateWebhookInput): Promise<WebhookRecord | undefined>
  deleteWebhook(webhookId: string): Promise<boolean>
  getWebhookStats(webhookId: string, sinceIso: string): Promise<WebhookStatsRecord>
  createWebhookDelivery(input: CreateWebhookDeliveryInput): Promise<WebhookDeliveryRecord>
  getWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryRecord | undefined>
  updateWebhookDelivery(deliveryId: string, input: UpdateWebhookDeliveryInput): Promise<WebhookDeliveryRecord | undefined>
  listWebhookDeliveries(query: ListWebhookDeliveriesQuery): Promise<ListWebhookDeliveriesResult>
}

export interface ListStatsEventsQuery {
  appId: string
  actions?: string[]
  devicesId?: string[]
  limit?: number
  search?: string
  start_date?: string
  end_date?: string
}

export interface StatsEventRecord extends StatsEvent {
  created_at: string
}

interface AppRow {
  stats_updated_at: string | null
  stats_refresh_requested_at: string | null
  app_id: string
  name: string
  owner_org: string | null
  expose_metadata: number | boolean | null
  transfer_history: string | null
  created_at: string
}

interface OrganizationRow {
  id: string
  name: string
  stats_updated_at: string | null
  last_stats_updated_at: string | null
  stats_refresh_requested_at: string | null
  management_email: string | null
  password_policy_config: Record<string, unknown> | string | null
  created_by: string | null
  enforce_encrypted_bundles: number | boolean | null
  required_encryption_key: string | null
  website: string | null
  customer_id: string | null
  created_at: string
}

interface UsageCreditGrantRow {
  id: string
  org_id: string
  amount: number
  notes: string | null
  created_by: string | null
  created_at: string
}

interface UsageCreditTransactionRow {
  amount: number
}

interface ReleaseRow {
  app_id: string
  version: string
  platform: Platform
  channel: string
  session_key: string | null
  key_id: string | null
  path: string
  checksum: string
  size: number
  mandatory: number
  rollout: number
  notes: string | null
  manifest: string | null
  native_packages: string | null
  min_update_version: string | null
  owner_org: string | null
  created_at: string
}

interface ChannelRow {
  app_id: string
  name: string
  public: number
  allow_self_set: number
  ios: number | null
  android: number | null
  electron: number | null
}
interface DeviceRow {
  app_id: string
  device_id: string
  platform: Platform | null
  plugin_version: string | null
  os_version: string | null
  version_build: string | null
  version_name: string | null
  custom_id: string | null
  key_id: string | null
  is_prod: number | null
  is_emulator: number | null
  default_channel: string | null
  updated_at: string
}
interface ApiKeyRow {
  id: number
  name: string
  key_hash: string
  rbac_id: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

interface ApiKeyBindingRow {
  apikey_id: number
  role_name: string
  scope_type: 'org' | 'app'
  org_id: string | null
  app_id: string | null
  reason: string | null
}

interface RoleBindingRow {
  id: string
  principal_type: RoleBindingPrincipalType
  principal_id: string
  role_name: string
  scope_type: RoleBindingScopeType
  org_id: string
  app_id: string | null
  channel_id: string | null
  reason: string | null
  is_direct: number | boolean
  created_at: string
  updated_at: string
}

interface ChannelPermissionOverrideRow {
  principal_type: RoleBindingPrincipalType
  principal_id: string
  channel_id: string
  permission_key: string
  is_allowed: number | boolean
}

interface ApiKeyGlobalPermissionRow {
  apikey_id: number
  permission_key: string
}
interface AuditLogRow {
  id: number
  created_at: string
  table_name: string
  record_id: string
  operation: AuditOperation
  user_id: string | null
  org_id: string
  old_record: string | null
  new_record: string | null
  changed_fields: string | null
}

interface CompatibilityEventRow {
  id: number
  org_id: string
  app_id: string
  source: 'default_channel_changed' | 'default_channel_version_changed'
  platform: 'ios' | 'android' | 'electron'
  channel_id: number
  channel_name: string
  current_version_id: number | null
  current_version_name: string | null
  previous_version_id: number | null
  previous_version_name: string | null
  offenders: string | null
  change_occurred_at: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_kind: string | null
  resolution_note: string | null
}

interface UserRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  updated_at: string
}

interface OrgUserRow {
  user_id: string
  org_id: string
  user_right: string
  created_at: string
}

interface SsoProviderRow {
  provider_id: string
  org_id: string
  domain: string | null
  enabled: number
  enforce_sso: number
  created_at: string
}

interface PendingInvitationRow {
  invite_magic_string: string
  email: string
  first_name: string | null
  last_name: string | null
  future_uuid: string
  org_id: string
  role: string
  cancelled_at: string | null
  created_at: string
}

interface BuildRequestRow {
  id: string
  app_id: string
  owner_org: string
  requested_by: string
  platform: Platform
  build_mode: string
  status: string
  builder_job_id: string
  created_at: string
  updated_at: string
}

interface BuildLogRow {
  build_id: string
  org_id: string
  user_id: string
  app_id: string
  platform: Platform
  build_time_unit: number
  billable_seconds: number
  created_at: string
  updated_at: string
}

interface DailyBuildTimeRow {
  app_id: string
  date: string
  build_time_unit: number
  build_count: number
}

interface DailyMauRow {
  app_id: string
  date: string
  mau: number
}

interface UsageOverageEventRow {
  id: string
  org_id: string
  metric: UsageCreditMetric
  overage_amount: number
  credits_consumed: number
  details: string | null
  created_at: string
}

interface StripeInfoRow {
  customer_id: string
  status: string | null
  is_good_plan: number | boolean | null
  plan_calculated_at: string | null
}


interface WebhookRow {
  id: string
  org_id: string
  name: string
  url: string
  secret: string | null
  enabled: number | boolean
  events: string | string[]
  delivery_version: WebhookDeliveryVersion | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface WebhookDeliveryRow {
  id: string
  webhook_id: string
  org_id: string
  audit_log_id: string | null
  event_type: string
  status: WebhookDeliveryStatus
  request_payload: string | Record<string, unknown>
  response_status: number | null
  response_body: string | null
  response_headers: string | Record<string, unknown> | null
  attempt_count: number
  max_attempts: number
  next_retry_at: string | null
  created_at: string
  completed_at: string | null
  duration_ms: number | null
  delivery_version: WebhookDeliveryVersion | null
}


function nowIso() {
  return new Date().toISOString()
}

function toApp(row: AppRow): AppRecord {
  const transferHistory = typeof row.transfer_history === 'string'
    ? JSON.parse(row.transfer_history || '[]') as AppTransferHistoryEntry[]
    : row.transfer_history ?? []
  return {
    appId: row.app_id,
    name: row.name,
    ownerOrg: row.owner_org ?? undefined,
    exposeMetadata: row.expose_metadata == null ? false : row.expose_metadata === true || row.expose_metadata === 1,
    statsUpdatedAt: row.stats_updated_at ?? null,
    statsRefreshRequestedAt: row.stats_refresh_requested_at ?? null,
    transferHistory,
    createdAt: row.created_at,
  }
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | undefined {
  if (!value)
    return undefined
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  }
  catch {
    return undefined
  }
}

function boolValue(value: number | boolean | null | undefined) {
  if (value == null)
    return undefined
  return typeof value === 'boolean' ? value : value === 1
}

function toOrganization(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    managementEmail: row.management_email ?? undefined,
    website: row.website ?? undefined,
    statsUpdatedAt: row.stats_updated_at ?? null,
    lastStatsUpdatedAt: row.last_stats_updated_at ?? null,
    statsRefreshRequestedAt: row.stats_refresh_requested_at ?? null,
    passwordPolicyConfig: row.password_policy_config == null
      ? null
      : typeof row.password_policy_config === 'string'
        ? JSON.parse(row.password_policy_config || 'null') as Record<string, unknown> | null
        : row.password_policy_config,
    enforceEncryptedBundles: boolValue(row.enforce_encrypted_bundles) ?? false,
    requiredEncryptionKey: row.required_encryption_key ?? null,
    createdBy: row.created_by ?? undefined,
    customerId: row.customer_id ?? undefined,
    createdAt: row.created_at,
  }
}

function toUsageCreditGrant(row: UsageCreditGrantRow): UsageCreditGrantRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    amount: Number(row.amount),
    notes: row.notes ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function parseReleaseManifest(value: string | null | unknown): ReleaseManifestEntry[] {
  if (!value)
    return []
  const parsed = typeof value === 'string' ? JSON.parse(value || '[]') as unknown : value
  return Array.isArray(parsed)
    ? parsed.filter((item): item is ReleaseManifestEntry => typeof item === 'object' && item !== null)
    : []
}

function toRelease(row: ReleaseRow): ReleaseRecord {
  return {
    appId: row.app_id,
    version: row.version,
    sessionKey: row.session_key ?? null,
    keyId: row.key_id ?? null,
    platform: row.platform,
    channel: row.channel,
    path: row.path,
    checksum: row.checksum,
    size: row.size,
    mandatory: row.mandatory === 1,
    manifest: parseReleaseManifest(row.manifest),
    nativePackages: parseNativePackages(row.native_packages),
    minUpdateVersion: row.min_update_version ?? null,
    rollout: row.rollout,
    notes: row.notes ?? undefined,
    ownerOrg: row.owner_org ?? undefined,
    createdAt: row.created_at,
  }
}

function toChannel(row: ChannelRow): ChannelRecord {
  return {
    id: row.name,
    name: row.name,
    public: row.public === 1,
    allowSelfSet: row.allow_self_set === 1,
    ios: row.ios == null ? undefined : row.ios === 1,
    android: row.android == null ? undefined : row.android === 1,
    electron: row.electron == null ? undefined : row.electron === 1,
  }
}
function toDevice(row: DeviceRow, channel?: string): DeviceRecord {
  return {
    appId: row.app_id,
    deviceId: row.device_id,
    platform: row.platform ?? undefined,
    pluginVersion: row.plugin_version ?? undefined,
    osVersion: row.os_version ?? undefined,
    keyId: row.key_id ?? undefined,
    versionBuild: row.version_build ?? undefined,
    versionName: row.version_name ?? undefined,
    customId: row.custom_id ?? undefined,
    isProd: row.is_prod == null ? undefined : row.is_prod === 1,
    isEmulator: row.is_emulator == null ? undefined : row.is_emulator === 1,
    defaultChannel: row.default_channel ?? undefined,
    channel,
    updatedAt: row.updated_at,
  }
}

function toApiKeyBinding(row: ApiKeyBindingRow): ApiKeyBindingRecord {
  return {
    roleName: row.role_name,
    scopeType: row.scope_type,
    orgId: row.org_id ?? undefined,
    appId: row.app_id ?? undefined,
    reason: row.reason ?? undefined,
  }
}

function toRoleBinding(row: RoleBindingRow): RoleBindingRecord {
  return {
    id: row.id,
    principalType: row.principal_type,
    principalId: row.principal_id,
    roleName: row.role_name,
    scopeType: row.scope_type,
    orgId: row.org_id,
    appId: row.app_id,
    channelId: row.channel_id,
    reason: row.reason,
    isDirect: row.is_direct === true || row.is_direct === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toChannelPermissionOverride(row: ChannelPermissionOverrideRow): ChannelPermissionOverrideRecord {
  return {
    principalType: row.principal_type,
    principalId: row.principal_id,
    channelId: row.channel_id,
    permissionKey: row.permission_key,
    isAllowed: row.is_allowed === true || row.is_allowed === 1,
  }
}

function normalizeChannelBindingId(value: string | number | null | undefined) {
  if (value == null)
    return null
  return String(value)
}

function legacyRoleForRoleBinding(roleName: string) {
  if (roleName === 'org_super_admin')
    return 'super_admin'
  if (roleName === 'org_admin')
    return 'admin'
  if (roleName.startsWith('org_'))
    return 'read'
  return null
}
function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toOrgMembership(row: OrgUserRow): OrgMembershipRecord {
  return {
    userId: row.user_id,
    orgId: row.org_id,
    role: row.user_right,
    createdAt: row.created_at,
  }
}
function toBuildRequest(row: BuildRequestRow): BuildRequestRecord {
  return {
    id: row.id,
    appId: row.app_id,
    ownerOrg: row.owner_org,
    requestedBy: row.requested_by,
    platform: row.platform,
    buildMode: row.build_mode,
    status: row.status,
    builderJobId: row.builder_job_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toBuildLog(row: BuildLogRow): BuildLogRecord {
  return {
    buildId: row.build_id,
    orgId: row.org_id,
    userId: row.user_id,
    appId: row.app_id,
    platform: row.platform,
    buildTimeUnit: row.build_time_unit,
    billableSeconds: row.billable_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDailyBuildTime(row: DailyBuildTimeRow): BuildTimeMetricsRecord {
  return {
    appId: row.app_id,
    date: row.date,
    buildTimeUnit: row.build_time_unit,
    buildCount: row.build_count,
  }
}

function toDailyMau(row: DailyMauRow): MauMetricsRecord {
  return {
    appId: row.app_id,
    date: row.date,
    mau: Number(row.mau),
  }
}

function toUsageOverageEvent(row: UsageOverageEventRow): UsageOverageEventRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    metric: row.metric,
    overageAmount: Number(row.overage_amount),
    creditsConsumed: Number(row.credits_consumed),
    details: parseJsonRecord(row.details),
    createdAt: row.created_at,
  }
}

function toStripeInfo(row: StripeInfoRow): StripeInfoRecord {
  return {
    customerId: row.customer_id,
    status: row.status,
    isGoodPlan: row.is_good_plan == null ? null : row.is_good_plan === true || row.is_good_plan === 1,
    planCalculatedAt: row.plan_calculated_at ?? null,
  }
}


function toWebhook(row: WebhookRow, includeSecret = false): WebhookRecord {
  const events = Array.isArray(row.events)
    ? row.events.filter((event): event is string => typeof event === 'string')
    : parseStringArray(row.events) ?? []
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    url: row.url,
    ...(includeSecret && row.secret ? { secret: row.secret } : {}),
    enabled: row.enabled === true || row.enabled === 1,
    events,
    deliveryVersion: row.delivery_version ?? 'legacy',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseWebhookDeliveryPayload(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== 'string')
    return { ...value }
  const parsed = parseJsonValue(value)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
}

function parseWebhookDeliveryHeaders(value: string | Record<string, unknown> | null): Record<string, unknown> | null {
  if (value === null)
    return null
  if (typeof value !== 'string')
    return { ...value }
  return parseJsonRecord(value)
}

function toWebhookDelivery(row: WebhookDeliveryRow): WebhookDeliveryRecord {
  return {
    id: row.id,
    webhookId: row.webhook_id,
    orgId: row.org_id,
    auditLogId: row.audit_log_id,
    eventType: row.event_type,
    status: row.status,
    requestPayload: parseWebhookDeliveryPayload(row.request_payload),
    responseStatus: row.response_status,
    responseBody: row.response_body,
    responseHeaders: parseWebhookDeliveryHeaders(row.response_headers),
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    deliveryVersion: row.delivery_version ?? 'legacy',
  }
}
function toPendingInvitation(row: PendingInvitationRow): PendingInvitationRecord {
  return {
    inviteMagicString: row.invite_magic_string,
    email: row.email,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    futureUuid: row.future_uuid,
    orgId: row.org_id,
    role: row.role,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  }
}

function buildTimeDateId(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function generateWebhookSecret() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return `whsec_${btoa(binary)}`
}

function billableBuildSeconds(platform: Platform, buildTimeUnit: number) {
  if (buildTimeUnit < 0 || !Number.isFinite(buildTimeUnit))
    throw new Error('build_time_unit must be a non-negative number')
  if (platform === 'ios')
    return buildTimeUnit * 2
  if (platform === 'android')
    return buildTimeUnit
  throw new Error('platform must be ios or android')
}

function legacyInviteRole(role: string) {
  if (role.includes('super_admin'))
    return 'super_admin'
  if (role.includes('admin'))
    return 'admin'
  return 'read'
}

function toSsoProvider(row: SsoProviderRow): SsoProviderRecord {
  return {
    providerId: row.provider_id,
    orgId: row.org_id,
    domain: row.domain ?? undefined,
    enabled: row.enabled === 1,
    enforceSso: row.enforce_sso === 1,
    createdAt: row.created_at,
  }
}

function toApiKey(row: ApiKeyRow, bindings: ApiKeyBindingRecord[], globalPermissions: string[]): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    rbacId: row.rbac_id,
    bindings,
    globalPermissions,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function apiKeyBindingParams(apiKeyId: number, binding: ApiKeyBindingRecord) {
  return [
    apiKeyId,
    binding.roleName,
    binding.scopeType,
    binding.orgId ?? null,
    binding.appId ?? null,
    binding.reason ?? null,
  ] as const
}
function parseJsonValue(value: string | null): unknown {
  if (value === null)
    return null
  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  const parsed = parseJsonValue(value)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
}

function parseNativePackages(value: string | null | unknown): Array<{ name: string, version: string, ios_checksum?: string, android_checksum?: string }> {
  const parsed = typeof value === 'string' || value === null ? parseJsonValue(value) : value
  if (!Array.isArray(parsed))
    return []
  return parsed.filter((item): item is { name: string, version: string, ios_checksum?: string, android_checksum?: string } => {
    return typeof item === 'object' && item !== null && typeof item.name === 'string' && typeof item.version === 'string'
  })
}

function parseStringArray(value: string | null): string[] | null {
  const parsed = parseJsonValue(value)
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : null
}

function toAuditLog(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    tableName: row.table_name,
    recordId: row.record_id,
    operation: row.operation,
    userId: row.user_id,
    orgId: row.org_id,
    oldRecord: parseJsonValue(row.old_record),
    newRecord: parseJsonValue(row.new_record),
    changedFields: parseStringArray(row.changed_fields),
  }
}

function toCompatibilityEvent(row: CompatibilityEventRow): StoredCompatibilityEvent {
  return {
    id: row.id,
    org_id: row.org_id,
    app_id: row.app_id,
    source: row.source,
    platform: row.platform,
    channel_id: row.channel_id,
    channel_name: row.channel_name,
    current_version_id: row.current_version_id,
    current_version_name: row.current_version_name,
    previous_version_id: row.previous_version_id,
    previous_version_name: row.previous_version_name,
    offenders: parseStringArray(row.offenders) ?? [],
    change_occurred_at: row.change_occurred_at,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    resolution_kind: row.resolution_kind,
    resolution_note: row.resolution_note,
  }
}

function auditRecordValue(value: unknown) {
  return value === undefined ? null : JSON.stringify(value)
}



function sortReleasesNewestFirst(releases: ReleaseRecord[]) {
  return releases.sort((a, b) => {
    const versionDiff = compareVersions(b.version, a.version)
    if (versionDiff !== 0)
      return versionDiff
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function releaseChannels(releases: ReleaseRecord[]): ChannelRecord[] {
  const names = Array.from(new Set(releases.map((release) => release.channel))).sort()
  return names.map((name) => ({
    id: name,
    name,
    public: name === 'production',
    allowSelfSet: true,
  }))
}

function mergeChannels(explicit: ChannelRecord[], releases: ReleaseRecord[]): ChannelRecord[] {
  const merged = new Map<string, ChannelRecord>()
  for (const channel of explicit)
    merged.set(channel.name, channel)
  for (const channel of releaseChannels(releases))
    merged.set(channel.name, merged.get(channel.name) ?? channel)
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}
function channelRow(input: UpsertChannelInput): ChannelRow {
  const bothMobile = input.ios === true && input.android === true
  return {
    app_id: input.appId,
    name: input.name,
    public: (input.public ?? input.name === 'production') ? 1 : 0,
    allow_self_set: (input.allowSelfSet ?? true) ? 1 : 0,
    ios: input.ios == null ? null : input.ios ? 1 : 0,
    android: input.android == null ? null : input.android ? 1 : 0,
    electron: input.electron == null ? bothMobile ? null : 0 : input.electron ? 1 : 0,
  }
}


function channelPlatformFlags(channel: Pick<ChannelRow, 'ios' | 'android' | 'electron'>) {
  return {
    ios: channel.ios === 1,
    android: channel.android === 1,
    electron: channel.electron === 1,
  }
}

function publicChannelsOverlap(a: Pick<ChannelRow, 'ios' | 'android' | 'electron'>, b: Pick<ChannelRow, 'ios' | 'android' | 'electron'>) {
  const left = channelPlatformFlags(a)
  const right = channelPlatformFlags(b)
  return (left.ios && right.ios) || (left.android && right.android) || (left.electron && right.electron)
}
function escapeSqlLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function creditBalance(orgId: string, totalCredits: number, usedCredits: number): UsageCreditBalanceRecord {
  const total = Math.max(0, totalCredits)
  const used = Math.max(0, usedCredits)
  return { orgId, totalCredits: total, usedCredits: used, availableCredits: Math.max(0, total - used) }
}

export class D1R2Storage implements StorageDriver {
  private readonly db: D1Database
  private readonly bundleBucket: R2Bucket

  constructor(env: Env) {
    if (!env.DB || !env.BUNDLES)
      throw new Error('D1R2Storage requires DB and BUNDLES bindings')
    this.db = env.DB
    this.bundleBucket = env.BUNDLES
  }

  async createApp(appId: string, name: string, ownerOrg?: string): Promise<AppRecord> {
    const createdAt = nowIso()
    const existing = await this.getApp(appId)
    await this.db.prepare(`
      INSERT INTO apps (app_id, name, owner_org, expose_metadata, transfer_history, stats_updated_at, stats_refresh_requested_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id) DO UPDATE SET
        name = excluded.name,
        owner_org = excluded.owner_org,
        expose_metadata = apps.expose_metadata,
        transfer_history = apps.transfer_history,
        stats_updated_at = apps.stats_updated_at,
        stats_refresh_requested_at = apps.stats_refresh_requested_at
    `).bind(appId, name, ownerOrg ?? existing?.ownerOrg ?? null, existing?.exposeMetadata ? 1 : 0, JSON.stringify(existing?.transferHistory ?? []), existing?.statsUpdatedAt ?? null, existing?.statsRefreshRequestedAt ?? null, existing?.createdAt ?? createdAt).run()
    await this.upsertChannel({ appId, name: 'production', public: true, allowSelfSet: true })

    const app = await this.getApp(appId)
    if (!app)
      throw new Error('App was not created')
    return app
  }

  async updateApp(appId: string, input: { name?: string, exposeMetadata?: boolean }): Promise<AppRecord | undefined> {
    const existing = await this.getApp(appId)
    if (!existing)
      return undefined
    await this.db.prepare(`
      UPDATE apps
      SET name = ?, expose_metadata = ?
      WHERE app_id = ?
    `).bind(input.name ?? existing.name, (input.exposeMetadata ?? existing.exposeMetadata ?? false) ? 1 : 0, appId).run()
    return this.getApp(appId)
  }

  async getApp(appId: string): Promise<AppRecord | undefined> {
    const row = await this.db.prepare('SELECT app_id, name, owner_org, expose_metadata, transfer_history, stats_updated_at, stats_refresh_requested_at, created_at FROM apps WHERE app_id = ?').bind(appId).first<AppRow>()
    return row ? toApp(row) : undefined
  }

  async listApps(): Promise<AppRecord[]> {
    const result = await this.db.prepare('SELECT app_id, name, owner_org, expose_metadata, transfer_history, stats_updated_at, stats_refresh_requested_at, created_at FROM apps ORDER BY created_at DESC').all<AppRow>()
    return result.results.map(toApp)
  }

  async transferApp(appId: string, newOwnerOrg: string): Promise<AppRecord | undefined> {
    const existing = await this.getApp(appId)
    if (!existing)
      return undefined
    const transferredAt = nowIso()
    const history = [...(existing.transferHistory ?? []), { fromOrg: existing.ownerOrg ?? null, toOrg: newOwnerOrg, transferredAt }]
    await this.db.prepare('UPDATE apps SET owner_org = ?, transfer_history = ? WHERE app_id = ?').bind(newOwnerOrg, JSON.stringify(history), appId).run()
    await this.db.prepare('UPDATE releases SET owner_org = ? WHERE app_id = ?').bind(newOwnerOrg, appId).run()
    return this.getApp(appId)
  }
  async deleteApp(appId: string): Promise<boolean> {
    const existing = await this.getApp(appId)
    if (!existing)
      return false
    await this.db.prepare('DELETE FROM apps WHERE app_id = ?').bind(appId).run()
    return true
  }

  async upsertOrganization(input: UpsertOrganizationInput): Promise<OrganizationRecord> {
    const createdAt = nowIso()
    await this.db.prepare(`
      INSERT INTO orgs (id, name, management_email, created_by, customer_id, website, password_policy_config, enforce_encrypted_bundles, required_encryption_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        management_email = excluded.management_email,
        created_by = excluded.created_by,
        customer_id = excluded.customer_id,
        website = excluded.website,
        password_policy_config = excluded.password_policy_config,
        enforce_encrypted_bundles = excluded.enforce_encrypted_bundles,
        required_encryption_key = excluded.required_encryption_key
    `).bind(input.id, input.name, input.managementEmail ?? null, input.createdBy ?? null, input.customerId ?? null, input.website ?? null, input.passwordPolicyConfig === undefined ? null : JSON.stringify(input.passwordPolicyConfig), input.enforceEncryptedBundles ? 1 : 0, input.requiredEncryptionKey ?? null, createdAt).run()
    const row = await this.db.prepare('SELECT id, name, management_email, created_by, customer_id, website, password_policy_config, enforce_encrypted_bundles, required_encryption_key, stats_updated_at, last_stats_updated_at, stats_refresh_requested_at, created_at FROM orgs WHERE id = ?').bind(input.id).first<OrganizationRow>()
    if (!row)
      throw new Error('Organization was not created')
    return toOrganization(row)
  }

  async searchOrganizations(query: string, limit = 20): Promise<OrganizationRecord[]> {
    const trimmed = query.trim()
    if (!trimmed)
      return []
    const pattern = `%${escapeSqlLike(trimmed).toLowerCase()}%`
    const result = await this.db.prepare(`
      SELECT id, name, management_email, created_by, customer_id, website, password_policy_config, enforce_encrypted_bundles, required_encryption_key, stats_updated_at, last_stats_updated_at, stats_refresh_requested_at, created_at
      FROM orgs
      WHERE lower(id) LIKE ? ESCAPE '\\'
        OR lower(name) LIKE ? ESCAPE '\\'
        OR lower(coalesce(management_email, '')) LIKE ? ESCAPE '\\'
        OR lower(coalesce(customer_id, '')) LIKE ? ESCAPE '\\'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(pattern, pattern, pattern, pattern, Math.max(1, Math.min(limit, 50))).all<OrganizationRow>()
    return result.results.map(toOrganization)
  }

  async getOrganization(orgId: string): Promise<OrganizationRecord | undefined> {
    const row = await this.db.prepare('SELECT id, name, management_email, created_by, customer_id, website, password_policy_config, enforce_encrypted_bundles, required_encryption_key, stats_updated_at, last_stats_updated_at, stats_refresh_requested_at, created_at FROM orgs WHERE id = ?').bind(orgId).first<OrganizationRow>()
    return row ? toOrganization(row) : undefined
  }

  async listOrganizations(): Promise<OrganizationRecord[]> {
    const result = await this.db.prepare('SELECT id, name, management_email, created_by, customer_id, website, password_policy_config, enforce_encrypted_bundles, required_encryption_key, stats_updated_at, last_stats_updated_at, stats_refresh_requested_at, created_at FROM orgs ORDER BY created_at DESC').all<OrganizationRow>()
    return result.results.map(toOrganization)
  }

  async deleteOrganization(orgId: string): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM orgs WHERE id = ?').bind(orgId).run()
    return (result.meta.changes ?? 0) > 0
  }

  async listOrgMemberships(orgId: string): Promise<OrgMemberRecord[]> {
    const result = await this.db.prepare(`
      SELECT org_users.user_id, org_users.org_id, org_users.user_right, org_users.created_at, users.email
      FROM org_users
      LEFT JOIN users ON users.id = org_users.user_id
      WHERE org_users.org_id = ?
      ORDER BY org_users.created_at ASC
    `).bind(orgId).all<OrgUserRow & { email: string | null }>()
    return result.results.map(row => ({ ...toOrgMembership(row), email: row.email ?? '' }))
  }

  async upsertOrgMembership(input: { orgId: string, userId: string, email: string, role: string }): Promise<OrgMemberRecord> {
    const now = nowIso()
    await this.db.prepare(`
      INSERT INTO users (id, email, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at
    `).bind(input.userId, input.email, now, now).run()
    await this.db.prepare(`
      INSERT INTO org_users (user_id, org_id, user_right, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, org_id) DO UPDATE SET user_right = excluded.user_right
    `).bind(input.userId, input.orgId, input.role, now).run()
    return { userId: input.userId, orgId: input.orgId, role: input.role, email: input.email, createdAt: now }
  }

  async deleteOrgMembershipByEmail(orgId: string, email: string): Promise<boolean> {
    const user = await this.db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(email).first<{ id: string }>()
    if (!user)
      return false
    const result = await this.db.prepare('DELETE FROM org_users WHERE org_id = ? AND user_id = ?').bind(orgId, user.id).run()
    return (result.meta.changes ?? 0) > 0
  }
  async createRoleBinding(input: CreateRoleBindingInput): Promise<RoleBindingRecord | undefined> {
    if (input.scopeType === 'app' || input.scopeType === 'channel') {
      if (!input.appId)
        return undefined
      const app = await this.getApp(input.appId)
      if (!app || app.ownerOrg !== input.orgId)
        return undefined
    }
    const id = crypto.randomUUID()
    const now = nowIso()
    const channelId = normalizeChannelBindingId(input.channelId)
    await this.db.prepare(`
      INSERT INTO role_bindings (id, principal_type, principal_id, role_name, scope_type, org_id, app_id, channel_id, reason, is_direct, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, input.principalType, input.principalId, input.roleName, input.scopeType, input.orgId, input.appId ?? null, channelId, input.reason ?? null, 1, now, now).run()

    const legacyRole = input.principalType === 'user' && input.scopeType === 'org' ? legacyRoleForRoleBinding(input.roleName) : null
    if (legacyRole) {
      const user = await this.getUser(input.principalId)
      await this.upsertOrgMembership({ orgId: input.orgId, userId: input.principalId, email: user?.email ?? '', role: legacyRole })
    }
    return this.getRoleBinding(id)
  }

  async getRoleBinding(id: string): Promise<RoleBindingRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT id, principal_type, principal_id, role_name, scope_type, org_id, app_id, channel_id, reason, is_direct, created_at, updated_at
      FROM role_bindings
      WHERE id = ?
    `).bind(id).first<RoleBindingRow>()
    return row ? toRoleBinding(row) : undefined
  }

  async updateRoleBinding(id: string, input: UpdateRoleBindingInput): Promise<RoleBindingRecord | undefined> {
    const existing = await this.getRoleBinding(id)
    if (!existing)
      return undefined
    if (existing.roleName === 'org_super_admin' && input.roleName !== 'org_super_admin') {
      const superAdmins = await this.db.prepare(`
        SELECT id FROM role_bindings
        WHERE org_id = ? AND scope_type = 'org' AND role_name = 'org_super_admin'
      `).bind(existing.orgId).all<{ id: string }>()
      if (superAdmins.results.length <= 1)
        return undefined
    }
    const now = nowIso()
    await this.db.prepare('UPDATE role_bindings SET role_name = ?, updated_at = ? WHERE id = ?').bind(input.roleName, now, id).run()
    const legacyRole = existing.principalType === 'user' && existing.scopeType === 'org' ? legacyRoleForRoleBinding(input.roleName) : null
    if (legacyRole) {
      const user = await this.getUser(existing.principalId)
      await this.upsertOrgMembership({ orgId: existing.orgId, userId: existing.principalId, email: user?.email ?? '', role: legacyRole })
    }
    return this.getRoleBinding(id)
  }

  async deleteRoleBinding(id: string): Promise<boolean> {
    const existing = await this.getRoleBinding(id)
    if (!existing)
      return false
    const result = await this.db.prepare('DELETE FROM role_bindings WHERE id = ?').bind(id).run()
    if ((result.meta.changes ?? 0) <= 0)
      return false
    if (existing.principalType === 'user' && existing.scopeType === 'org') {
      await this.db.prepare('UPDATE org_users SET user_right = NULL WHERE org_id = ? AND user_id = ?').bind(existing.orgId, existing.principalId).run()
    }
    if (existing.principalType === 'user' && existing.scopeType === 'app') {
      await this.db.prepare('DELETE FROM channel_permission_overrides WHERE principal_type = ? AND principal_id = ?').bind(existing.principalType, existing.principalId).run()
    }
    return true
  }

  async listRoleBindingsForAppScope(appId: string, scopeType?: RoleBindingScopeType): Promise<RoleBindingRecord[]> {
    const result = scopeType
      ? await this.db.prepare(`
        SELECT id, principal_type, principal_id, role_name, scope_type, org_id, app_id, channel_id, reason, is_direct, created_at, updated_at
        FROM role_bindings
        WHERE app_id = ? AND scope_type = ?
        ORDER BY created_at ASC
      `).bind(appId, scopeType).all<RoleBindingRow>()
      : await this.db.prepare(`
        SELECT id, principal_type, principal_id, role_name, scope_type, org_id, app_id, channel_id, reason, is_direct, created_at, updated_at
        FROM role_bindings
        WHERE app_id = ?
        ORDER BY created_at ASC
      `).bind(appId).all<RoleBindingRow>()
    return result.results.map(toRoleBinding)
  }

  async upsertChannelPermissionOverride(input: ChannelPermissionOverrideRecord): Promise<ChannelPermissionOverrideRecord> {
    await this.db.prepare(`
      INSERT INTO channel_permission_overrides (principal_type, principal_id, channel_id, permission_key, is_allowed)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(principal_type, principal_id, channel_id, permission_key) DO UPDATE SET is_allowed = excluded.is_allowed
    `).bind(input.principalType, input.principalId, input.channelId, input.permissionKey, input.isAllowed ? 1 : 0).run()
    return { ...input }
  }

  async listChannelPermissionOverrides(principalType: RoleBindingPrincipalType, principalId: string): Promise<ChannelPermissionOverrideRecord[]> {
    const result = await this.db.prepare(`
      SELECT principal_type, principal_id, channel_id, permission_key, is_allowed
      FROM channel_permission_overrides
      WHERE principal_type = ? AND principal_id = ?
      ORDER BY channel_id ASC, permission_key ASC
    `).bind(principalType, principalId).all<ChannelPermissionOverrideRow>()
    return result.results.map(toChannelPermissionOverride)
  }


  async getUsageCreditBalance(orgId: string): Promise<UsageCreditBalanceRecord | undefined> {
    const org = await this.db.prepare('SELECT id FROM orgs WHERE id = ?').bind(orgId).first<{ id: string }>()
    if (!org)
      return undefined
    const grants = await this.db.prepare('SELECT coalesce(sum(amount), 0) AS amount FROM usage_credit_grants WHERE org_id = ?').bind(orgId).first<UsageCreditTransactionRow>()
    const used = await this.db.prepare('SELECT coalesce(sum(amount), 0) AS amount FROM usage_credit_transactions WHERE org_id = ?').bind(orgId).first<UsageCreditTransactionRow>()
    return creditBalance(orgId, Number(grants?.amount ?? 0), Number(used?.amount ?? 0))
  }

  async grantUsageCredits(input: GrantUsageCreditsInput): Promise<{ org: OrganizationRecord, grant: UsageCreditGrantRecord, balance: UsageCreditBalanceRecord } | undefined> {
    const orgRow = await this.db.prepare('SELECT id, name, management_email, created_by, customer_id, created_at FROM orgs WHERE id = ?').bind(input.orgId).first<OrganizationRow>()
    if (!orgRow)
      return undefined
    const id = crypto.randomUUID()
    const createdAt = nowIso()
    await this.db.prepare(`
      INSERT INTO usage_credit_grants (id, org_id, amount, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, input.orgId, input.amount, input.notes ?? null, input.createdBy ?? null, createdAt).run()
    const balance = await this.getUsageCreditBalance(input.orgId)
    return { org: toOrganization(orgRow), grant: { id, orgId: input.orgId, amount: input.amount, notes: input.notes, createdBy: input.createdBy ?? null, createdAt }, balance: balance ?? creditBalance(input.orgId, input.amount, 0) }
  }
  async consumeUsageCredits(input: ConsumeUsageCreditsInput): Promise<{ balance: UsageCreditBalanceRecord, overageEvent?: UsageOverageEventRecord } | undefined> {
    const existing = await this.getUsageCreditBalance(input.orgId)
    if (!existing)
      return undefined
    const existingOverageEvent = findMatchingUsageOverageEvent(await this.listUsageOverageEvents(input.orgId), input)
    if (input.metric && input.overageAmount !== undefined && !shouldCreateUsageOverageEvent(existingOverageEvent, input))
      return { balance: existing, overageEvent: existingOverageEvent }

    const amount = Math.max(0, Math.ceil(input.amount))
    const createdAt = nowIso()
    const statements = [
      this.db.prepare('INSERT INTO usage_credit_transactions (id, org_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), input.orgId, amount, input.reason ?? null, createdAt),
    ]
    let overageEvent: UsageOverageEventRecord | undefined
    if (input.metric && input.overageAmount !== undefined) {
      const id = crypto.randomUUID()
      const details = input.details ?? {}
      overageEvent = {
        id,
        orgId: input.orgId,
        metric: input.metric,
        overageAmount: input.overageAmount,
        creditsConsumed: amount,
        details,
        createdAt,
      }
      statements.push(this.db.prepare(`
        INSERT INTO usage_overage_events (id, org_id, metric, overage_amount, credits_consumed, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, input.orgId, input.metric, input.overageAmount, amount, JSON.stringify(details), createdAt))
    }
    await this.db.batch(statements)
    const balance = await this.getUsageCreditBalance(input.orgId)
    return { balance: balance ?? creditBalance(input.orgId, existing.totalCredits, existing.usedCredits + amount), overageEvent }
  }

  async listUsageCreditGrants(limit = 50): Promise<UsageCreditGrantRecord[]> {
    const result = await this.db.prepare(`
      SELECT id, org_id, amount, notes, created_by, created_at
      FROM usage_credit_grants
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(Math.max(1, Math.min(limit, 100))).all<UsageCreditGrantRow>()
    return result.results.map(toUsageCreditGrant)
  }

  async listUsageOverageEvents(orgId: string): Promise<UsageOverageEventRecord[]> {
    const result = await this.db.prepare(`
      SELECT id, org_id, metric, overage_amount, credits_consumed, details, created_at
      FROM usage_overage_events
      WHERE org_id = ?
      ORDER BY created_at DESC
    `).bind(orgId).all<UsageOverageEventRow>()
    return (result.results ?? []).map(toUsageOverageEvent)
  }

  async upsertStripeInfo(input: UpsertStripeInfoInput): Promise<StripeInfoRecord> {
    await this.db.prepare(`
      INSERT INTO stripe_info (customer_id, status, is_good_plan, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(customer_id) DO UPDATE SET
        status = excluded.status,
        is_good_plan = excluded.is_good_plan,
        updated_at = excluded.updated_at
    `).bind(input.customerId, input.status ?? null, input.isGoodPlan == null ? null : input.isGoodPlan ? 1 : 0, nowIso()).run()
    const row = await this.db.prepare('SELECT customer_id, status, is_good_plan, plan_calculated_at FROM stripe_info WHERE customer_id = ?').bind(input.customerId).first<StripeInfoRow>()
    if (!row)
      throw new Error('Stripe info was not stored')
    return toStripeInfo(row)
  }

  async getStripeInfoByCustomerId(customerId: string): Promise<StripeInfoRecord | undefined> {
    const row = await this.db.prepare('SELECT customer_id, status, is_good_plan, plan_calculated_at FROM stripe_info WHERE customer_id = ?').bind(customerId).first<StripeInfoRow>()
    return row ? toStripeInfo(row) : undefined
  }

  async markAppStatsRefreshed(appId: string, refreshedAt = nowIso()): Promise<AppRecord | undefined> {
    await this.db.prepare('UPDATE apps SET stats_updated_at = ? WHERE app_id = ?').bind(refreshedAt, appId).run()
    return this.getApp(appId)
  }

  async markOrgStatsRefreshed(orgId: string, refreshedAt = nowIso()): Promise<OrganizationRecord | undefined> {
    const existing = await this.getOrganization(orgId)
    if (!existing)
      return undefined
    await this.db.prepare('UPDATE orgs SET last_stats_updated_at = COALESCE(stats_updated_at, last_stats_updated_at), stats_updated_at = ? WHERE id = ?').bind(refreshedAt, orgId).run()
    return this.getOrganization(orgId)
  }

  async markStripePlanCalculated(customerId: string, calculatedAt = nowIso()): Promise<StripeInfoRecord | undefined> {
    await this.db.prepare('UPDATE stripe_info SET plan_calculated_at = ?, updated_at = ? WHERE customer_id = ?').bind(calculatedAt, calculatedAt, customerId).run()
    return this.getStripeInfoByCustomerId(customerId)
  }

  async upsertSsoProvider(provider: Pick<SsoProviderRecord, 'providerId' | 'orgId'> & Partial<SsoProviderRecord>): Promise<SsoProviderRecord> {
    const createdAt = provider.createdAt ?? nowIso()
    await this.db.prepare(`
      INSERT INTO sso_providers (provider_id, org_id, domain, enabled, enforce_sso, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id) DO UPDATE SET
        org_id = excluded.org_id,
        domain = excluded.domain,
        enabled = excluded.enabled,
        enforce_sso = excluded.enforce_sso
    `).bind(provider.providerId, provider.orgId, provider.domain ?? null, (provider.enabled ?? true) ? 1 : 0, (provider.enforceSso ?? false) ? 1 : 0, createdAt).run()
    const row = await this.db.prepare(`
      SELECT provider_id, org_id, domain, enabled, enforce_sso, created_at
      FROM sso_providers
      WHERE provider_id = ?
    `).bind(provider.providerId).first<SsoProviderRow>()
    if (!row)
      throw new Error('SSO provider was not created')
    return toSsoProvider(row)
  }

  async getSsoProvider(providerId: string): Promise<SsoProviderRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT provider_id, org_id, domain, enabled, enforce_sso, created_at
      FROM sso_providers
      WHERE provider_id = ?
    `).bind(providerId).first<SsoProviderRow>()
    return row ? toSsoProvider(row) : undefined
  }

  async provisionSsoUser(input: SsoProvisionInput): Promise<SsoProvisionResult | undefined> {
    const provider = await this.db.prepare(`
      SELECT provider_id, org_id, domain, enabled, enforce_sso, created_at
      FROM sso_providers
      WHERE provider_id = ? AND enabled = 1
    `).bind(input.providerId).first<SsoProviderRow>()
    if (!provider && !input.orgId)
      return undefined

    const orgId = input.orgId ?? provider!.org_id
    if (input.orgId && !provider)
      await this.upsertSsoProvider({ providerId: input.providerId, orgId })

    const existingMembership = await this.getOrgMembership(input.userId, orgId)
    const now = nowIso()
    await this.db.prepare(`
      INSERT INTO users (id, email, first_name, last_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = excluded.updated_at
    `).bind(input.userId, input.email, input.firstName ?? null, input.lastName ?? null, now, now).run()
    if (!existingMembership) {
      await this.db.prepare(`
        INSERT INTO org_users (user_id, org_id, user_right, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, org_id) DO NOTHING
      `).bind(input.userId, orgId, 'read', now).run()
    }
    return { success: true, merged: false, alreadyMember: !!existingMembership, orgId, userId: input.userId }
  }

  async getUser(userId: string): Promise<UserRecord | undefined> {
    const row = await this.db.prepare('SELECT id, email, first_name, last_name, created_at, updated_at FROM users WHERE id = ?').bind(userId).first<UserRow>()
    return row ? toUser(row) : undefined
  }

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const row = await this.db.prepare('SELECT id, email, first_name, last_name, created_at, updated_at FROM users WHERE lower(email) = lower(?)').bind(email).first<UserRow>()
    return row ? toUser(row) : undefined
  }

  async getOrgMembership(userId: string, orgId: string): Promise<OrgMembershipRecord | undefined> {
    const row = await this.db.prepare('SELECT user_id, org_id, user_right, created_at FROM org_users WHERE user_id = ? AND org_id = ?').bind(userId, orgId).first<OrgUserRow>()
    return row ? toOrgMembership(row) : undefined
  }

  async createPendingInvitation(input: CreatePendingInvitationInput): Promise<PendingInvitationRecord> {
    const createdAt = nowIso()
    await this.db.prepare(`
      INSERT INTO tmp_users (invite_magic_string, email, first_name, last_name, future_uuid, org_id, role, cancelled_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(invite_magic_string) DO UPDATE SET
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        future_uuid = excluded.future_uuid,
        org_id = excluded.org_id,
        role = excluded.role,
        cancelled_at = excluded.cancelled_at
    `).bind(input.inviteMagicString, input.email, input.firstName ?? null, input.lastName ?? null, input.futureUuid, input.orgId, input.role, input.cancelledAt ?? null, createdAt).run()
    const invitation = await this.getPendingInvitation(input.inviteMagicString)
    if (!invitation)
      throw new Error('Invitation was not created')
    return invitation
  }

  async getPendingInvitation(inviteMagicString: string): Promise<PendingInvitationRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT invite_magic_string, email, first_name, last_name, future_uuid, org_id, role, cancelled_at, created_at
      FROM tmp_users
      WHERE invite_magic_string = ?
    `).bind(inviteMagicString).first<PendingInvitationRow>()
    return row ? toPendingInvitation(row) : undefined
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult | undefined> {
    const invitation = await this.getPendingInvitation(input.magicInviteString)
    if (!invitation || invitation.cancelledAt)
      return undefined
    const now = nowIso()
    await this.db.prepare(`
      INSERT INTO users (id, email, first_name, last_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = excluded.updated_at
    `).bind(invitation.futureUuid, invitation.email, invitation.firstName ?? null, invitation.lastName ?? null, now, now).run()
    const role = legacyInviteRole(invitation.role)
    await this.db.prepare(`
      INSERT INTO org_users (user_id, org_id, user_right, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, org_id) DO UPDATE SET user_right = excluded.user_right
    `).bind(invitation.futureUuid, invitation.orgId, role, now).run()
    await this.db.prepare('DELETE FROM tmp_users WHERE invite_magic_string = ?').bind(input.magicInviteString).run()
    return { success: true, userId: invitation.futureUuid, orgId: invitation.orgId, role }
  }
  async listApiKeys(): Promise<ApiKeyRecord[]> {
    const result = await this.db.prepare(`
      SELECT id, name, key_hash, rbac_id, expires_at, created_at, updated_at
      FROM apikeys
      ORDER BY created_at DESC
    `).all<ApiKeyRow>()
    const records: ApiKeyRecord[] = []
    for (const row of result.results) {
      const record = await this.getApiKey(row.id)
      if (record)
        records.push(record)
    }
    return records
  }

  async getApiKey(id: number): Promise<ApiKeyRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT id, name, key_hash, rbac_id, expires_at, created_at, updated_at
      FROM apikeys
      WHERE id = ?
    `).bind(id).first<ApiKeyRow>()
    if (!row)
      return undefined
    return toApiKey(row, await this.getApiKeyBindings(id), await this.getApiKeyGlobalPermissions(id))
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT id, name, key_hash, rbac_id, expires_at, created_at, updated_at
      FROM apikeys
      WHERE key_hash = ?
    `).bind(keyHash).first<ApiKeyRow>()
    return row ? this.getApiKey(row.id) : undefined
  }

  async createApiKey(input: CreateApiKeyInput): Promise<ApiKeyRecord> {
    const createdAt = nowIso()
    const rbacId = crypto.randomUUID()
    const result = await this.db.prepare(`
      INSERT INTO apikeys (name, key_hash, rbac_id, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(input.name, input.keyHash, rbacId, input.expiresAt ?? null, createdAt, createdAt).run()
    const id = Number((result.meta as { last_row_id?: number | string }).last_row_id)
    if (!Number.isFinite(id))
      throw new Error('API key was not created')
    await this.replaceApiKeyBindings(id, input.bindings)
    await this.replaceApiKeyGlobalPermissions(id, input.globalPermissions ?? [])
    const record = await this.getApiKey(id)
    if (!record)
      throw new Error('API key was not created')
    return record
  }

  async updateApiKey(id: number, input: UpdateApiKeyInput): Promise<ApiKeyRecord | undefined> {
    const existing = await this.getApiKey(id)
    if (!existing)
      return undefined
    const updatedAt = nowIso()
    await this.db.prepare(`
      UPDATE apikeys
      SET name = ?, key_hash = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      input.name ?? existing.name,
      input.keyHash ?? existing.keyHash,
      Object.prototype.hasOwnProperty.call(input, 'expiresAt') ? input.expiresAt ?? null : existing.expiresAt,
      updatedAt,
      id,
    ).run()
    if (input.bindings)
      await this.replaceApiKeyBindings(id, input.bindings)
    if (input.globalPermissions)
      await this.replaceApiKeyGlobalPermissions(id, input.globalPermissions)
    return this.getApiKey(id)
  }

  async recordBuildTime(input: RecordBuildTimeInput): Promise<BuildLogRecord> {
    const billableSeconds = billableBuildSeconds(input.platform, input.buildTimeUnit)
    const now = nowIso()
    const existing = await this.db.prepare(`
      SELECT build_id, org_id, user_id, app_id, platform, build_time_unit, billable_seconds, created_at, updated_at
      FROM build_logs
      WHERE build_id = ?
    `).bind(input.buildId).first<BuildLogRow>()
    await this.db.prepare(`
      INSERT INTO build_logs (build_id, org_id, user_id, app_id, platform, build_time_unit, billable_seconds, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(build_id) DO UPDATE SET
        org_id = excluded.org_id,
        user_id = excluded.user_id,
        app_id = excluded.app_id,
        platform = excluded.platform,
        build_time_unit = excluded.build_time_unit,
        billable_seconds = excluded.billable_seconds,
        updated_at = excluded.updated_at
    `).bind(input.buildId, input.orgId, input.userId, input.appId, input.platform, input.buildTimeUnit, billableSeconds, existing?.created_at ?? now, now).run()

    const affectedDates = new Set([buildTimeDateId(existing ? new Date(existing.created_at) : new Date()), buildTimeDateId(new Date(now))])
    for (const date of affectedDates)
      await this.recomputeDailyBuildTime(input.appId, date)

    const row = await this.db.prepare(`
      SELECT build_id, org_id, user_id, app_id, platform, build_time_unit, billable_seconds, created_at, updated_at
      FROM build_logs
      WHERE build_id = ?
    `).bind(input.buildId).first<BuildLogRow>()
    if (!row)
      throw new Error('build time was not recorded')
    return toBuildLog(row)
  }

  private async recomputeDailyBuildTime(appId: string, date: string): Promise<void> {
    const start = `${date}T00:00:00.000Z`
    const end = `${date}T23:59:59.999Z`
    const aggregate = await this.db.prepare(`
      SELECT COALESCE(SUM(billable_seconds), 0) AS build_time_unit, COUNT(*) AS build_count
      FROM build_logs
      WHERE app_id = ? AND created_at >= ? AND created_at <= ?
    `).bind(appId, start, end).first<{ build_time_unit: number, build_count: number }>()
    await this.db.prepare(`
      INSERT INTO daily_build_time (app_id, date, build_time_unit, build_count, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(app_id, date) DO UPDATE SET
        build_time_unit = excluded.build_time_unit,
        build_count = excluded.build_count,
        updated_at = excluded.updated_at
    `).bind(appId, date, aggregate?.build_time_unit ?? 0, aggregate?.build_count ?? 0, nowIso()).run()
  }

  async listBuildLogsByOrg(orgId: string): Promise<BuildLogRecord[]> {
    const result = await this.db.prepare(`
      SELECT build_id, org_id, user_id, app_id, platform, build_time_unit, billable_seconds, created_at, updated_at
      FROM build_logs
      WHERE org_id = ?
      ORDER BY created_at DESC
    `).bind(orgId).all<BuildLogRow>()
    return (result.results ?? []).map(toBuildLog)
  }

  async getDailyBuildTime(appId: string, date: string): Promise<BuildTimeMetricsRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT app_id, date, build_time_unit, build_count
      FROM daily_build_time
      WHERE app_id = ? AND date = ?
    `).bind(appId, date).first<DailyBuildTimeRow>()
    return row ? toDailyBuildTime(row) : undefined
  }

  async listDailyBuildTimeByOrg(orgId: string): Promise<BuildTimeMetricsRecord[]> {
    const result = await this.db.prepare(`
      SELECT d.app_id, d.date, d.build_time_unit, d.build_count
      FROM daily_build_time d
      JOIN apps a ON a.app_id = d.app_id
      WHERE a.owner_org = ?
      ORDER BY d.date DESC
    `).bind(orgId).all<DailyBuildTimeRow>()
    return (result.results ?? []).map(toDailyBuildTime)
  }

  async recordMauUsage(input: RecordMauUsageInput): Promise<MauMetricsRecord> {
    await this.db.prepare(`
      INSERT INTO daily_mau (app_id, date, mau, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(app_id, date) DO UPDATE SET
        mau = excluded.mau,
        updated_at = excluded.updated_at
    `).bind(input.appId, input.date, Math.max(0, Math.ceil(input.mau)), nowIso()).run()
    const row = await this.db.prepare('SELECT app_id, date, mau FROM daily_mau WHERE app_id = ? AND date = ?').bind(input.appId, input.date).first<DailyMauRow>()
    if (!row)
      throw new Error('MAU usage was not recorded')
    return toDailyMau(row)
  }

  async listDailyMauByOrg(orgId: string): Promise<MauMetricsRecord[]> {
    const result = await this.db.prepare(`
      SELECT d.app_id, d.date, d.mau
      FROM daily_mau d
      JOIN apps a ON a.app_id = d.app_id
      WHERE a.owner_org = ?
      ORDER BY d.date DESC
    `).bind(orgId).all<DailyMauRow>()
    return (result.results ?? []).map(toDailyMau)
  }

  async createBuildRequest(input: CreateBuildRequestInput): Promise<BuildRequestRecord> {
    const createdAt = nowIso()
    const id = input.id ?? crypto.randomUUID()
    await this.db.prepare(`
      INSERT INTO build_requests (id, app_id, owner_org, requested_by, platform, build_mode, status, builder_job_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      input.appId,
      input.ownerOrg,
      input.requestedBy,
      input.platform,
      input.buildMode,
      input.status ?? 'pending',
      input.builderJobId,
      createdAt,
      createdAt,
    ).run()
    const record = await this.getBuildRequestByJobId(input.builderJobId)
    if (!record)
      throw new Error('Build request was not created')
    return record
  }

  async getBuildRequestByJobId(jobId: string): Promise<BuildRequestRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT id, app_id, owner_org, requested_by, platform, build_mode, status, builder_job_id, created_at, updated_at
      FROM build_requests
      WHERE builder_job_id = ?
    `).bind(jobId).first<BuildRequestRow>()
    return row ? toBuildRequest(row) : undefined
  }

  async updateBuildRequestStatus(jobId: string, status: string): Promise<BuildRequestRecord | undefined> {
    const updatedAt = nowIso()
    await this.db.prepare('UPDATE build_requests SET status = ?, updated_at = ? WHERE builder_job_id = ?').bind(status, updatedAt, jobId).run()
    return this.getBuildRequestByJobId(jobId)
  }

  async deleteApiKey(id: number): Promise<boolean> {
    const existing = await this.getApiKey(id)
    if (!existing)
      return false
    await this.db.prepare('DELETE FROM apikey_global_permissions WHERE apikey_id = ?').bind(id).run()
    await this.db.prepare('DELETE FROM apikey_bindings WHERE apikey_id = ?').bind(id).run()
    await this.db.prepare('DELETE FROM apikeys WHERE id = ?').bind(id).run()
    return true
  }

  private async getApiKeyBindings(id: number): Promise<ApiKeyBindingRecord[]> {
    const result = await this.db.prepare(`
      SELECT apikey_id, role_name, scope_type, org_id, app_id, reason
      FROM apikey_bindings
      WHERE apikey_id = ?
      ORDER BY id ASC
    `).bind(id).all<ApiKeyBindingRow>()
    return result.results.map(toApiKeyBinding)
  }

  private async getApiKeyGlobalPermissions(id: number): Promise<string[]> {
    const result = await this.db.prepare(`
      SELECT apikey_id, permission_key
      FROM apikey_global_permissions
      WHERE apikey_id = ?
      ORDER BY permission_key ASC
    `).bind(id).all<ApiKeyGlobalPermissionRow>()
    return result.results.map((row) => row.permission_key)
  }

  private async replaceApiKeyBindings(id: number, bindings: ApiKeyBindingRecord[]): Promise<void> {
    await this.db.prepare('DELETE FROM apikey_bindings WHERE apikey_id = ?').bind(id).run()
    for (const binding of bindings) {
      await this.db.prepare(`
        INSERT INTO apikey_bindings (apikey_id, role_name, scope_type, org_id, app_id, reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(...apiKeyBindingParams(id, binding)).run()
    }
  }

  private async replaceApiKeyGlobalPermissions(id: number, permissions: string[]): Promise<void> {
    await this.db.prepare('DELETE FROM apikey_global_permissions WHERE apikey_id = ?').bind(id).run()
    for (const permission of permissions) {
      await this.db.prepare(`
        INSERT INTO apikey_global_permissions (apikey_id, permission_key)
        VALUES (?, ?)
      `).bind(id, permission).run()
    }
  }
  async recordAuditLog(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const createdAt = nowIso()
    const result = await this.db.prepare(`
      INSERT INTO audit_logs (created_at, table_name, record_id, operation, user_id, org_id, old_record, new_record, changed_fields)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      createdAt,
      input.tableName,
      input.recordId,
      input.operation,
      input.userId ?? null,
      input.orgId,
      auditRecordValue(input.oldRecord),
      auditRecordValue(input.newRecord),
      input.changedFields ? JSON.stringify(input.changedFields) : null,
    ).run()
    const id = Number((result.meta as { last_row_id?: number | string }).last_row_id)
    const row = await this.db.prepare(`
      SELECT id, created_at, table_name, record_id, operation, user_id, org_id, old_record, new_record, changed_fields
      FROM audit_logs
      WHERE id = ?
    `).bind(id).first<AuditLogRow>()
    if (!row)
      throw new Error('Audit log was not created')
    return toAuditLog(row)
  }

  async listAuditLogs(query: ListAuditLogsQuery): Promise<ListAuditLogsResult> {
    const clauses = ['org_id = ?']
    const params: unknown[] = [query.orgId]
    if (query.tableName) {
      clauses.push('table_name = ?')
      params.push(query.tableName)
    }
    if (query.operation) {
      clauses.push('operation = ?')
      params.push(query.operation)
    }
    const where = clauses.join(' AND ')
    const totalRow = await this.db.prepare(`SELECT COUNT(*) AS total FROM audit_logs WHERE ${where}`).bind(...params).first<{ total: number }>()
    const result = await this.db.prepare(`
      SELECT id, created_at, table_name, record_id, operation, user_id, org_id, old_record, new_record, changed_fields
      FROM audit_logs
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(...params, query.limit, query.page * query.limit).all<AuditLogRow>()
    return {
      data: result.results.map(toAuditLog),
      total: Number(totalRow?.total ?? 0),
      page: query.page,
      limit: query.limit,
    }
  }



  async createRelease(input: CreateReleaseInput): Promise<ReleaseRecord> {
    let app = await this.getApp(input.appId)
    if (!app)
      app = await this.createApp(input.appId, input.appId)
    await this.upsertChannel({ appId: input.appId, name: input.channel, public: input.channel === 'production', allowSelfSet: true })

    const createdAt = nowIso()
    const path = `apps/${input.appId}/${input.platform}/${input.channel}/${input.version}/bundle.zip`

    await this.bundleBucket.put(path, input.bytes, {
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: { checksum: input.checksum },
    })

    await this.db.prepare(`
      INSERT INTO releases (app_id, version, platform, channel, path, checksum, session_key, key_id, size, mandatory, rollout, notes, min_update_version, native_packages, owner_org, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, platform, channel, version) DO UPDATE SET
        path = excluded.path,
        checksum = excluded.checksum,
        session_key = excluded.session_key,
        key_id = excluded.key_id,
        size = excluded.size,
        mandatory = excluded.mandatory,
        rollout = excluded.rollout,
        notes = excluded.notes,
        min_update_version = excluded.min_update_version,
        native_packages = excluded.native_packages,
        owner_org = excluded.owner_org,
        created_at = excluded.created_at
    `).bind(
      input.appId,
      input.version,
      input.platform,
      input.channel,
      path,
      input.checksum,
      input.sessionKey ?? null,
      input.keyId ?? null,
      input.size,
      input.mandatory ? 1 : 0,
      input.rollout,
      input.notes ?? null,
      input.minUpdateVersion ?? null,
      JSON.stringify(input.nativePackages ?? []),
      app.ownerOrg ?? null,
      createdAt,
    ).run()

    const release = await this.getRelease(input.appId, input.platform, input.channel, input.version)
    if (!release)
      throw new Error('Release was not created')
    return release
  }

  async listReleases(appId: string): Promise<ReleaseRecord[]> {
    const result = await this.db.prepare(`
      SELECT app_id, version, platform, channel, path, checksum, session_key, key_id, size, mandatory, rollout, notes, min_update_version, native_packages, owner_org, created_at
      FROM releases
      WHERE app_id = ?
      ORDER BY created_at DESC
    `).bind(appId).all<ReleaseRow>()
    return sortReleasesNewestFirst(result.results.map(toRelease))
  }

  async upsertVersionMeta(input: UpsertVersionMetaInput): Promise<boolean> {
    if (input.size === 0)
      return false
    const app = await this.getApp(input.appId)
    if (!app)
      return false
    const releases = await this.listReleases(input.appId)
    if (!releases[input.versionId - 1])
      return false

    const signClause = input.size > 0 ? 'size > 0' : 'size < 0'
    const existing = await this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM version_meta
      WHERE app_id = ? AND version_id = ? AND ${signClause}
    `).bind(input.appId, input.versionId).first<{ total: number }>()
    if (Number(existing?.total ?? 0) > 0)
      return false

    await this.db.prepare(`
      INSERT INTO version_meta (app_id, version_id, size, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(input.appId, input.versionId, input.size, nowIso()).run()
    return true
  }

  async deleteReleases(appId: string, version?: string): Promise<boolean> {
    const releases = await this.listReleases(appId)
    const matches = version ? releases.filter((release) => release.version === version) : releases
    if (matches.length === 0)
      return false
    for (const release of matches)
      await this.bundleBucket.delete(release.path)
    if (version)
      await this.db.prepare('DELETE FROM releases WHERE app_id = ? AND version = ?').bind(appId, version).run()
    else
      await this.db.prepare('DELETE FROM releases WHERE app_id = ?').bind(appId).run()
    return true
  }

  async listChannels(appId: string, platform?: Platform): Promise<ChannelRecord[]> {
    const explicit = await this.db.prepare('SELECT app_id, name, public, allow_self_set, ios, android, electron FROM channels WHERE app_id = ?').bind(appId).all<ChannelRow>()
    const releases = await this.listReleases(appId)
    return mergeChannels(explicit.results.map(toChannel), platform ? releases.filter((release) => release.platform === platform) : releases)
  }

  async upsertChannel(input: UpsertChannelInput): Promise<ChannelRecord> {
    const row = channelRow(input)
    if (row.public === 1) {
      const existing = await this.db.prepare('SELECT app_id, name, public, allow_self_set, ios, android, electron FROM channels WHERE app_id = ? AND public = 1 AND name <> ?').bind(row.app_id, row.name).all<ChannelRow>()
      for (const channel of existing.results) {
        if (publicChannelsOverlap(row, channel))
          await this.db.prepare('UPDATE channels SET public = 0, updated_at = ? WHERE app_id = ? AND name = ?').bind(nowIso(), row.app_id, channel.name).run()
      }
    }
    await this.db.prepare(`
      INSERT INTO channels (app_id, name, public, allow_self_set, ios, android, electron, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, name) DO UPDATE SET
        public = excluded.public,
        allow_self_set = excluded.allow_self_set,
        ios = excluded.ios,
        android = excluded.android,
        electron = excluded.electron,
        updated_at = excluded.updated_at
    `).bind(row.app_id, row.name, row.public, row.allow_self_set, row.ios, row.android, row.electron, nowIso(), nowIso()).run()
    return toChannel(row)
  }

  async deleteChannel(appId: string, channel: string): Promise<boolean> {
    const channels = await this.listChannels(appId)
    if (!channels.some((record) => record.name === channel))
      return false
    await this.db.prepare('DELETE FROM channels WHERE app_id = ? AND name = ?').bind(appId, channel).run()
    await this.db.prepare('DELETE FROM releases WHERE app_id = ? AND channel = ?').bind(appId, channel).run()
    await this.db.prepare('DELETE FROM device_channels WHERE app_id = ? AND channel = ?').bind(appId, channel).run()
    return true
  }

  async getRelease(appId: string, platform: Platform, channel: string, version: string): Promise<ReleaseRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT app_id, version, platform, channel, path, checksum, session_key, key_id, size, mandatory, rollout, notes, min_update_version, native_packages, owner_org, created_at
      FROM releases
      WHERE app_id = ? AND platform = ? AND channel = ? AND version = ?
    `).bind(appId, platform, channel, version).first<ReleaseRow>()
    return row ? toRelease(row) : undefined
  }

  async findLatestRelease(appId: string, platform: Platform, channel: string): Promise<ReleaseRecord | undefined> {
    const result = await this.db.prepare(`
      SELECT app_id, version, platform, channel, path, checksum, session_key, key_id, size, mandatory, rollout, notes, min_update_version, native_packages, owner_org, created_at
      FROM releases
      WHERE app_id = ? AND platform = ? AND channel = ?
    `).bind(appId, platform, channel).all<ReleaseRow>()
    return sortReleasesNewestFirst(result.results.map(toRelease))[0]
  }

  async getBundle(release: ReleaseRecord): Promise<BundleObject | undefined> {
    const object = await this.bundleBucket.get(release.path)
    if (!object)
      return undefined
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType ?? 'application/zip',
      size: object.size,
      checksum: object.customMetadata?.checksum ?? release.checksum,
    }
  }

  async listDevices(appId: string): Promise<DeviceRecord[]> {
    const result = await this.db.prepare(`
      SELECT app_id, device_id, platform, plugin_version, os_version, version_build, version_name, custom_id, key_id, is_prod, is_emulator, default_channel, updated_at
      FROM devices
      WHERE app_id = ?
      ORDER BY updated_at DESC
    `).bind(appId).all<DeviceRow>()
    const devices: DeviceRecord[] = []
    for (const row of result.results)
      devices.push(toDevice(row, await this.getDeviceChannel(row.app_id, row.device_id)))
    return devices
  }

  async getDevice(appId: string, deviceId: string): Promise<DeviceRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT app_id, device_id, platform, plugin_version, os_version, version_build, version_name, custom_id, key_id, is_prod, is_emulator, default_channel, updated_at
      FROM devices
      WHERE app_id = ? AND device_id = ?
    `).bind(appId, deviceId).first<DeviceRow>()
    return row ? toDevice(row, await this.getDeviceChannel(appId, deviceId)) : undefined
  }

  async upsertDevice(input: UpsertDeviceInput): Promise<DeviceRecord> {
    const updatedAt = nowIso()
    await this.db.prepare(`
      INSERT INTO devices (app_id, device_id, platform, plugin_version, os_version, version_build, version_name, custom_id, key_id, is_prod, is_emulator, default_channel, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, device_id) DO UPDATE SET
        platform = excluded.platform,
        plugin_version = excluded.plugin_version,
        os_version = excluded.os_version,
        version_build = excluded.version_build,
        version_name = excluded.version_name,
        custom_id = excluded.custom_id,
        key_id = excluded.key_id,
        is_prod = excluded.is_prod,
        is_emulator = excluded.is_emulator,
        default_channel = excluded.default_channel,
        updated_at = excluded.updated_at
    `).bind(
      input.appId,
      input.deviceId,
      input.platform ?? null,
      input.pluginVersion ?? null,
      input.osVersion ?? null,
      input.versionBuild ?? null,
      input.versionName ?? null,
      input.customId ?? null,
      input.keyId ?? null,
      input.isProd == null ? null : input.isProd ? 1 : 0,
      input.isEmulator == null ? null : input.isEmulator ? 1 : 0,
      input.defaultChannel ?? null,
      updatedAt,
    ).run()
    if (input.channel)
      await this.setDeviceChannel(input.appId, input.deviceId, input.channel)
    const device = await this.getDevice(input.appId, input.deviceId)
    if (!device)
      throw new Error('Device was not created')
    return device
  }

  async deleteDevice(appId: string, deviceId: string): Promise<boolean> {
    await this.clearDeviceChannel(appId, deviceId)
    const existing = await this.getDevice(appId, deviceId)
    await this.db.prepare('DELETE FROM devices WHERE app_id = ? AND device_id = ?').bind(appId, deviceId).run()
    return !!existing
  }

  async getDeviceChannel(appId: string, deviceId: string): Promise<string | undefined> {
    const row = await this.db.prepare(`
      SELECT channel
      FROM device_channels
      WHERE app_id = ? AND device_id = ?
    `).bind(appId, deviceId).first<{ channel: string }>()
    return row?.channel
  }

  async setDeviceChannel(appId: string, deviceId: string, channel: string): Promise<void> {
    const updatedAt = nowIso()
    await this.db.prepare(`
      INSERT INTO device_channels (app_id, device_id, channel, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(app_id, device_id) DO UPDATE SET
        channel = excluded.channel,
        updated_at = excluded.updated_at
    `).bind(appId, deviceId, channel, updatedAt, updatedAt).run()
  }

  async clearDeviceChannel(appId: string, deviceId: string): Promise<void> {
    await this.db.prepare('DELETE FROM device_channels WHERE app_id = ? AND device_id = ?').bind(appId, deviceId).run()
  }

  async recordStats(event: StatsEvent): Promise<void> {
    await this.db.prepare(`
      INSERT INTO stats_events (app_id, bundle_id, device_id, platform, version_name, action, plugin_version, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.app_id,
      event.bundle_id ?? event.app_id,
      event.device_id,
      event.platform,
      event.version_name,
      event.action,
      event.plugin_version ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      nowIso(),
    ).run()
  }

  async listStatsEvents(query: ListStatsEventsQuery): Promise<StatsEventRecord[]> {
    const clauses = ['app_id = ?']
    const params: unknown[] = [query.appId]
    if (query.actions?.length) {
      clauses.push(`action IN (${query.actions.map(() => '?').join(', ')})`)
      params.push(...query.actions)
    }
    if (query.devicesId?.length) {
      clauses.push(`device_id IN (${query.devicesId.map(() => '?').join(', ')})`)
      params.push(...query.devicesId)
    }
    if (query.start_date) {
      clauses.push('created_at >= ?')
      params.push(query.start_date)
    }
    if (query.end_date) {
      clauses.push('created_at <= ?')
      params.push(query.end_date)
    }
    if (query.search) {
      clauses.push('(device_id LIKE ? OR version_name LIKE ? OR action LIKE ?)')
      const search = `%${query.search}%`
      params.push(search, search, search)
    }
    const limit = Math.min(query.limit ?? 100, 1000)
    params.push(limit)
    const result = await this.db.prepare(`
      SELECT app_id, bundle_id, device_id, platform, version_name, action, plugin_version, metadata, created_at
      FROM stats_events
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(...params).all<{
      app_id: string
      bundle_id: string | null
      device_id: string
      platform: Platform
      version_name: string
      action: StatsEvent['action']
      plugin_version: string | null
      metadata: string | null
      created_at: string
    }>()
    return (result.results ?? []).map(row => ({
      app_id: row.app_id,
      bundle_id: row.bundle_id ?? undefined,
      device_id: row.device_id,
      platform: row.platform,
      version_name: row.version_name,
      action: row.action,
      plugin_version: row.plugin_version ?? undefined,
      metadata: parseJsonObject(row.metadata),
      created_at: row.created_at,
    }))
  }

  async recordEvent(event: ConsoleEvent): Promise<void> {
    await this.db.prepare(`
      INSERT INTO console_events (channel, event, description, icon, notify, notify_console, org_id, user_id, tracking_version, tags, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.channel,
      event.event,
      event.description ?? null,
      event.icon ?? null,
      event.notify ? 1 : 0,
      event.notifyConsole ? 1 : 0,
      event.orgId ?? null,
      event.userId ?? null,
      event.trackingVersion ?? null,
      event.tags ? JSON.stringify(event.tags) : null,
      event.createdAt,
    ).run()
  }

  async createWebhook(input: CreateWebhookInput): Promise<WebhookRecord> {
    const id = crypto.randomUUID()
    const now = nowIso()
    const secret = generateWebhookSecret()
    await this.db.prepare(`
      INSERT INTO webhooks (id, org_id, name, url, secret, enabled, events, delivery_version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, input.orgId, input.name, input.url, secret, input.enabled ?? true ? 1 : 0, JSON.stringify(input.events), input.deliveryVersion, input.createdBy ?? null, now, now).run()
    const webhook = await this.getWebhook(id)
    if (!webhook)
      throw new Error('Webhook was not created')
    return { ...webhook, secret }
  }

  async getWebhook(webhookId: string): Promise<WebhookRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT id, org_id, name, url, secret, enabled, events, delivery_version, created_by, created_at, updated_at
      FROM webhooks
      WHERE id = ?
    `).bind(webhookId).first<WebhookRow>()
    return row ? toWebhook(row, true) : undefined
  }

  async listWebhooks(orgId: string, page: number, perPage: number): Promise<WebhookRecord[]> {
    const result = await this.db.prepare(`
      SELECT id, org_id, name, url, secret, enabled, events, delivery_version, created_by, created_at, updated_at
      FROM webhooks
      WHERE org_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(orgId, perPage, page * perPage).all<WebhookRow>()
    return result.results.map(row => toWebhook(row))
  }

  async updateWebhook(webhookId: string, input: UpdateWebhookInput): Promise<WebhookRecord | undefined> {
    const existing = await this.getWebhook(webhookId)
    if (!existing)
      return undefined
    const updatedAt = nowIso()
    await this.db.prepare(`
      UPDATE webhooks
      SET name = ?, url = ?, events = ?, enabled = ?, delivery_version = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      input.name ?? existing.name,
      input.url ?? existing.url,
      JSON.stringify(input.events ?? existing.events),
      (input.enabled ?? existing.enabled) ? 1 : 0,
      input.deliveryVersion ?? existing.deliveryVersion,
      updatedAt,
      webhookId,
    ).run()
    return this.getWebhook(webhookId)
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM webhooks WHERE id = ?').bind(webhookId).run()
    return (result.meta.changes ?? 0) > 0
  }

  async getWebhookStats(webhookId: string, sinceIso: string): Promise<WebhookStatsRecord> {
    const result = await this.db.prepare(`
      SELECT status, count(*) AS count
      FROM webhook_deliveries
      WHERE webhook_id = ? AND created_at >= ?
      GROUP BY status
    `).bind(webhookId, sinceIso).all<{ status: WebhookDeliveryStatus, count: number }>()
    const stats: WebhookStatsRecord = { success: 0, failed: 0, pending: 0 }
    for (const row of result.results)
      stats[row.status] = Number(row.count)
    return stats
  }

  async createWebhookDelivery(input: CreateWebhookDeliveryInput): Promise<WebhookDeliveryRecord> {
    const id = input.id ?? crypto.randomUUID()
    const createdAt = nowIso()
    await this.db.prepare(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, org_id, audit_log_id, event_type, status, request_payload,
        response_status, response_body, response_headers, attempt_count, max_attempts,
        next_retry_at, created_at, completed_at, duration_ms, delivery_version
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      input.webhookId,
      input.orgId,
      input.auditLogId ?? null,
      input.eventType,
      input.status ?? 'pending',
      JSON.stringify(input.requestPayload),
      input.responseStatus ?? null,
      input.responseBody ?? null,
      input.responseHeaders ? JSON.stringify(input.responseHeaders) : null,
      input.attemptCount ?? 0,
      input.maxAttempts ?? 10,
      null,
      createdAt,
      null,
      null,
      input.deliveryVersion,
    ).run()
    const delivery = await this.getWebhookDelivery(id)
    if (!delivery)
      throw new Error('Webhook delivery was not created')
    return delivery
  }

  async getWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryRecord | undefined> {
    const row = await this.db.prepare(`
      SELECT id, webhook_id, org_id, audit_log_id, event_type, status, request_payload, response_status,
        response_body, response_headers, attempt_count, max_attempts, next_retry_at, created_at,
        completed_at, duration_ms, delivery_version
      FROM webhook_deliveries
      WHERE id = ?
    `).bind(deliveryId).first<WebhookDeliveryRow>()
    return row ? toWebhookDelivery(row) : undefined
  }

  async updateWebhookDelivery(deliveryId: string, input: UpdateWebhookDeliveryInput): Promise<WebhookDeliveryRecord | undefined> {
    const existing = await this.getWebhookDelivery(deliveryId)
    if (!existing)
      return undefined
    await this.db.prepare(`
      UPDATE webhook_deliveries
      SET status = ?, response_status = ?, response_body = ?, response_headers = ?, attempt_count = ?,
        next_retry_at = ?, completed_at = ?, duration_ms = ?
      WHERE id = ?
    `).bind(
      input.status ?? existing.status,
      Object.hasOwn(input, 'responseStatus') ? input.responseStatus ?? null : existing.responseStatus ?? null,
      Object.hasOwn(input, 'responseBody') ? input.responseBody ?? null : existing.responseBody ?? null,
      Object.hasOwn(input, 'responseHeaders') ? input.responseHeaders ? JSON.stringify(input.responseHeaders) : null : existing.responseHeaders ? JSON.stringify(existing.responseHeaders) : null,
      input.attemptCount ?? existing.attemptCount,
      Object.hasOwn(input, 'nextRetryAt') ? input.nextRetryAt ?? null : existing.nextRetryAt ?? null,
      Object.hasOwn(input, 'completedAt') ? input.completedAt ?? null : existing.completedAt ?? null,
      Object.hasOwn(input, 'durationMs') ? input.durationMs ?? null : existing.durationMs ?? null,
      deliveryId,
    ).run()
    return this.getWebhookDelivery(deliveryId)
  }

  async listWebhookDeliveries(query: ListWebhookDeliveriesQuery): Promise<ListWebhookDeliveriesResult> {
    const clauses = ['webhook_id = ?']
    const params: unknown[] = [query.webhookId]
    if (query.status) {
      clauses.push('status = ?')
      params.push(query.status)
    }
    const countRow = await this.db.prepare(`SELECT count(*) AS count FROM webhook_deliveries WHERE ${clauses.join(' AND ')}`).bind(...params).first<{ count: number }>()
    const result = await this.db.prepare(`
      SELECT id, webhook_id, org_id, audit_log_id, event_type, status, request_payload, response_status,
        response_body, response_headers, attempt_count, max_attempts, next_retry_at, created_at,
        completed_at, duration_ms, delivery_version
      FROM webhook_deliveries
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, query.perPage, query.page * query.perPage).all<WebhookDeliveryRow>()
    return { deliveries: result.results.map(toWebhookDelivery), total: Number(countRow?.count ?? 0) }
  }

  async createCompatibilityEvent(input: CreateCompatibilityEventInput): Promise<StoredCompatibilityEvent> {
    const createdAt = nowIso()
    await this.db.prepare(`
      INSERT INTO compatibility_events (
        org_id, app_id, source, platform, channel_id, channel_name,
        current_version_id, current_version_name, previous_version_id, previous_version_name,
        offenders, change_occurred_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, channel_id, platform, current_version_id, previous_version_id, change_occurred_at)
      DO UPDATE SET
        org_id = excluded.org_id,
        source = excluded.source,
        channel_name = excluded.channel_name,
        current_version_name = excluded.current_version_name,
        previous_version_name = excluded.previous_version_name,
        offenders = excluded.offenders
    `).bind(
      input.org_id,
      input.app_id,
      input.source,
      input.platform,
      input.channel_id,
      input.channel_name,
      input.current_version_id,
      input.current_version_name,
      input.previous_version_id,
      input.previous_version_name,
      JSON.stringify(input.offenders),
      input.change_occurred_at,
      createdAt,
    ).run()
    const row = await this.db.prepare(`
      SELECT * FROM compatibility_events
      WHERE app_id = ? AND channel_id = ? AND platform = ? AND current_version_id = ? AND previous_version_id = ? AND change_occurred_at = ?
    `).bind(input.app_id, input.channel_id, input.platform, input.current_version_id, input.previous_version_id, input.change_occurred_at).first<CompatibilityEventRow>()
    if (!row)
      throw new Error('Compatibility event was not created')
    return toCompatibilityEvent(row)
  }

  async getCompatibilityEvent(id: number): Promise<StoredCompatibilityEvent | undefined> {
    const row = await this.db.prepare('SELECT * FROM compatibility_events WHERE id = ?').bind(id).first<CompatibilityEventRow>()
    return row ? toCompatibilityEvent(row) : undefined
  }

  async listCompatibilityEvents(appId: string): Promise<StoredCompatibilityEvent[]> {
    const result = await this.db.prepare('SELECT * FROM compatibility_events WHERE app_id = ? ORDER BY created_at DESC, id DESC').bind(appId).all<CompatibilityEventRow>()
    return result.results.map(toCompatibilityEvent)
  }

  async acknowledgeCompatibilityEvent(input: AcknowledgeCompatibilityEventInput): Promise<StoredCompatibilityEvent | undefined> {
    const existing = await this.getCompatibilityEvent(input.id)
    if (!existing || existing.resolved_at)
      return existing
    const resolvedAt = nowIso()
    await this.db.prepare(`
      UPDATE compatibility_events
      SET resolved_at = ?, resolved_by = ?, resolution_kind = 'accepted', resolution_note = ?
      WHERE id = ? AND resolved_at IS NULL
    `).bind(resolvedAt, input.resolvedBy ?? null, input.note, input.id).run()
    return this.getCompatibilityEvent(input.id)
  }
}
export class MemoryStorage implements StorageDriver {
  readonly apps = new Map<string, AppRecord>()
  readonly releases = new Map<string, ReleaseRecord>()
  readonly versionMeta: VersionMetaRecord[] = []
  readonly bundles = new Map<string, { bytes: Uint8Array, checksum: string }>()
  readonly stats: StatsEvent[] = []
  readonly events: ConsoleEvent[] = []
  readonly channels = new Map<string, ChannelRecord>()
  readonly devices = new Map<string, DeviceRecord>()
  readonly deviceChannels = new Map<string, string>()
  readonly apiKeys = new Map<number, ApiKeyRecord>()
  readonly auditLogs: AuditLogRecord[] = []
  readonly users = new Map<string, UserRecord>()
  readonly orgUsers = new Map<string, OrgMembershipRecord>()
  readonly ssoProviders = new Map<string, SsoProviderRecord>()
  readonly organizations = new Map<string, OrganizationRecord>()
  readonly roleBindings = new Map<string, RoleBindingRecord>()
  readonly channelPermissionOverrides: ChannelPermissionOverrideRecord[] = []
  readonly webhooks = new Map<string, WebhookRecord>()
  readonly webhookDeliveries = new Map<string, WebhookDeliveryRecord>()

  async getOrganization(orgId: string): Promise<OrganizationRecord | undefined> {
    const org = this.organizations.get(orgId)
    return org ? { ...org } : undefined
  }

  async listOrganizations(): Promise<OrganizationRecord[]> {
    return Array.from(this.organizations.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(org => ({ ...org }))
  }

  async deleteOrganization(orgId: string): Promise<boolean> {
    const deleted = this.organizations.delete(orgId)
    for (const key of this.orgUsers.keys()) {
      if (key.endsWith(`:${orgId}`))
        this.orgUsers.delete(key)
    }
    return deleted
  }

  async listOrgMemberships(orgId: string): Promise<OrgMemberRecord[]> {
    return Array.from(this.orgUsers.values())
      .filter(membership => membership.orgId === orgId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((membership) => ({
        ...membership,
        email: this.users.get(membership.userId)?.email ?? '',
      }))
  }

  async upsertOrgMembership(input: { orgId: string, userId: string, email: string, role: string }): Promise<OrgMemberRecord> {
    const now = nowIso()
    const existingUser = this.users.get(input.userId)
    this.users.set(input.userId, {
      id: input.userId,
      email: input.email,
      createdAt: existingUser?.createdAt ?? now,
      updatedAt: now,
    })
    const key = this.orgUserKey(input.userId, input.orgId)
    const existingMembership = this.orgUsers.get(key)
    const membership: OrgMembershipRecord = {
      userId: input.userId,
      orgId: input.orgId,
      role: input.role,
      createdAt: existingMembership?.createdAt ?? now,
    }
    this.orgUsers.set(key, membership)
    return { ...membership, email: input.email }
  }

  async deleteOrgMembershipByEmail(orgId: string, email: string): Promise<boolean> {
    const user = Array.from(this.users.values()).find(candidate => candidate.email.toLowerCase() === email.toLowerCase())
    if (!user)
      return false
    return this.orgUsers.delete(this.orgUserKey(user.id, orgId))
  }

  async createRoleBinding(input: CreateRoleBindingInput): Promise<RoleBindingRecord | undefined> {
    if (input.scopeType === 'app' || input.scopeType === 'channel') {
      if (!input.appId)
        return undefined
      const app = await this.getApp(input.appId)
      if (!app || app.ownerOrg !== input.orgId)
        return undefined
    }
    const now = nowIso()
    const record: RoleBindingRecord = {
      id: crypto.randomUUID(),
      principalType: input.principalType,
      principalId: input.principalId,
      roleName: input.roleName,
      scopeType: input.scopeType,
      orgId: input.orgId,
      appId: input.appId ?? null,
      channelId: normalizeChannelBindingId(input.channelId),
      reason: input.reason ?? null,
      isDirect: true,
      createdAt: now,
      updatedAt: now,
    }
    this.roleBindings.set(record.id, record)
    const legacyRole = record.principalType === 'user' && record.scopeType === 'org' ? legacyRoleForRoleBinding(record.roleName) : null
    if (legacyRole) {
      const user = this.users.get(record.principalId)
      await this.upsertOrgMembership({ orgId: record.orgId, userId: record.principalId, email: user?.email ?? '', role: legacyRole })
    }
    return { ...record }
  }

  async getRoleBinding(id: string): Promise<RoleBindingRecord | undefined> {
    const record = this.roleBindings.get(id)
    return record ? { ...record } : undefined
  }

  async updateRoleBinding(id: string, input: UpdateRoleBindingInput): Promise<RoleBindingRecord | undefined> {
    const existing = this.roleBindings.get(id)
    if (!existing)
      return undefined
    if (existing.roleName === 'org_super_admin' && input.roleName !== 'org_super_admin') {
      const superAdmins = Array.from(this.roleBindings.values()).filter(binding => binding.orgId === existing.orgId && binding.scopeType === 'org' && binding.roleName === 'org_super_admin')
      if (superAdmins.length <= 1)
        return undefined
    }
    const updated = { ...existing, roleName: input.roleName, updatedAt: nowIso() }
    this.roleBindings.set(id, updated)
    const legacyRole = updated.principalType === 'user' && updated.scopeType === 'org' ? legacyRoleForRoleBinding(updated.roleName) : null
    if (legacyRole) {
      const user = this.users.get(updated.principalId)
      await this.upsertOrgMembership({ orgId: updated.orgId, userId: updated.principalId, email: user?.email ?? '', role: legacyRole })
    }
    return { ...updated }
  }

  async deleteRoleBinding(id: string): Promise<boolean> {
    const existing = this.roleBindings.get(id)
    if (!existing)
      return false
    this.roleBindings.delete(id)
    if (existing.principalType === 'user' && existing.scopeType === 'org') {
      const membership = this.orgUsers.get(this.orgUserKey(existing.principalId, existing.orgId))
      if (membership)
        this.orgUsers.set(this.orgUserKey(existing.principalId, existing.orgId), { ...membership, role: '' })
    }
    if (existing.principalType === 'user' && existing.scopeType === 'app') {
      for (let index = this.channelPermissionOverrides.length - 1; index >= 0; index -= 1) {
        const override = this.channelPermissionOverrides[index]
        if (override.principalType === existing.principalType && override.principalId === existing.principalId)
          this.channelPermissionOverrides.splice(index, 1)
      }
    }
    return true
  }

  async listRoleBindingsForAppScope(appId: string, scopeType?: RoleBindingScopeType): Promise<RoleBindingRecord[]> {
    return Array.from(this.roleBindings.values())
      .filter(binding => binding.appId === appId && (!scopeType || binding.scopeType === scopeType))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(binding => ({ ...binding }))
  }

  async upsertChannelPermissionOverride(input: ChannelPermissionOverrideRecord): Promise<ChannelPermissionOverrideRecord> {
    const index = this.channelPermissionOverrides.findIndex(override => override.principalType === input.principalType && override.principalId === input.principalId && override.channelId === input.channelId && override.permissionKey === input.permissionKey)
    const record = { ...input }
    if (index >= 0)
      this.channelPermissionOverrides[index] = record
    else
      this.channelPermissionOverrides.push(record)
    return { ...record }
  }

  async listChannelPermissionOverrides(principalType: RoleBindingPrincipalType, principalId: string): Promise<ChannelPermissionOverrideRecord[]> {
    return this.channelPermissionOverrides
      .filter(override => override.principalType === principalType && override.principalId === principalId)
      .map(override => ({ ...override }))
  }
  readonly usageCreditGrants: UsageCreditGrantRecord[] = []
  readonly usageCreditTransactions: Array<{ orgId: string, amount: number, reason: string | null, createdAt: string }> = []
  readonly usageOverageEvents: UsageOverageEventRecord[] = []
  readonly stripeInfo = new Map<string, StripeInfoRecord>()
  readonly compatibilityEvents: StoredCompatibilityEvent[] = []
  readonly pendingInvitations = new Map<string, PendingInvitationRecord>()
  readonly buildLogs = new Map<string, BuildLogRecord>()
  readonly dailyMau = new Map<string, MauMetricsRecord>()
  readonly buildRequests = new Map<string, BuildRequestRecord>()
  private nextApiKeyId = 1
  private nextAuditLogId = 1
  async createApp(appId: string, name: string, ownerOrg?: string): Promise<AppRecord> {
    const existing = this.apps.get(appId)
    const app = {
      appId,
      name,
      ownerOrg: ownerOrg ?? existing?.ownerOrg,
      exposeMetadata: existing?.exposeMetadata ?? false,
      transferHistory: existing?.transferHistory ? [...existing.transferHistory] : [],
      createdAt: existing?.createdAt ?? nowIso(),
    }
    this.apps.set(appId, app)
    await this.upsertChannel({ appId, name: 'production', public: true, allowSelfSet: true })
    return app
  }

  async updateApp(appId: string, input: { name?: string, exposeMetadata?: boolean }): Promise<AppRecord | undefined> {
    const existing = this.apps.get(appId)
    if (!existing)
      return undefined
    const app = {
      ...existing,
      name: input.name ?? existing.name,
      exposeMetadata: input.exposeMetadata ?? existing.exposeMetadata ?? false,
      transferHistory: existing.transferHistory ? [...existing.transferHistory] : [],
    }
    this.apps.set(appId, app)
    return { ...app, transferHistory: app.transferHistory ? [...app.transferHistory] : [] }
  }
  async getApp(appId: string): Promise<AppRecord | undefined> {
    const app = this.apps.get(appId)
    return app ? { ...app, transferHistory: app.transferHistory ? [...app.transferHistory] : [] } : undefined
  }

  async upsertOrganization(input: UpsertOrganizationInput): Promise<OrganizationRecord> {
    const existing = this.organizations.get(input.id)
    const record: OrganizationRecord = {
      id: input.id,
      name: input.name,
      managementEmail: input.managementEmail ?? undefined,
      createdBy: input.createdBy ?? undefined,
      website: input.website ?? undefined,
      passwordPolicyConfig: input.passwordPolicyConfig ?? null,
      enforceEncryptedBundles: input.enforceEncryptedBundles ?? false,
      requiredEncryptionKey: input.requiredEncryptionKey ?? null,
      customerId: input.customerId ?? undefined,
      createdAt: existing?.createdAt ?? nowIso(),
    }
    this.organizations.set(record.id, record)
    return { ...record }
  }

  async searchOrganizations(query: string, limit = 20): Promise<OrganizationRecord[]> {
    const needle = query.trim().toLowerCase()
    if (!needle)
      return []
    return Array.from(this.organizations.values())
      .filter((org) => [org.id, org.name, org.managementEmail, org.customerId].some(value => value?.toLowerCase().includes(needle)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 50)))
      .map(org => ({ ...org }))
  }

  async getUsageCreditBalance(orgId: string): Promise<UsageCreditBalanceRecord | undefined> {
    if (!this.organizations.has(orgId))
      return undefined
    const totalCredits = this.usageCreditGrants.filter(grant => grant.orgId === orgId).reduce((sum, grant) => sum + grant.amount, 0)
    const usedCredits = this.usageCreditTransactions.filter(transaction => transaction.orgId === orgId).reduce((sum, transaction) => sum + transaction.amount, 0)
    return creditBalance(orgId, totalCredits, usedCredits)
  }

  async grantUsageCredits(input: GrantUsageCreditsInput): Promise<{ org: OrganizationRecord, grant: UsageCreditGrantRecord, balance: UsageCreditBalanceRecord } | undefined> {
    const org = this.organizations.get(input.orgId)
    if (!org)
      return undefined
    const grant: UsageCreditGrantRecord = {
      id: crypto.randomUUID(),
      orgId: input.orgId,
      amount: input.amount,
      notes: input.notes,
      createdBy: input.createdBy ?? null,
      createdAt: nowIso(),
    }
    this.usageCreditGrants.push(grant)
    const balance = await this.getUsageCreditBalance(input.orgId)
    return { org: { ...org }, grant: { ...grant }, balance: balance ?? creditBalance(input.orgId, input.amount, 0) }
  }
  async consumeUsageCredits(input: ConsumeUsageCreditsInput): Promise<{ balance: UsageCreditBalanceRecord, overageEvent?: UsageOverageEventRecord } | undefined> {
    const existing = await this.getUsageCreditBalance(input.orgId)
    if (!existing)
      return undefined
    const existingOverageEvent = findMatchingUsageOverageEvent(await this.listUsageOverageEvents(input.orgId), input)
    if (input.metric && input.overageAmount !== undefined && !shouldCreateUsageOverageEvent(existingOverageEvent, input))
      return { balance: existing, overageEvent: existingOverageEvent ? { ...existingOverageEvent, details: { ...existingOverageEvent.details } } : undefined }

    const amount = Math.max(0, Math.ceil(input.amount))
    const createdAt = nowIso()
    this.usageCreditTransactions.push({ orgId: input.orgId, amount, reason: input.reason ?? null, createdAt })
    let overageEvent: UsageOverageEventRecord | undefined
    if (input.metric && input.overageAmount !== undefined) {
      overageEvent = {
        id: crypto.randomUUID(),
        orgId: input.orgId,
        metric: input.metric,
        overageAmount: input.overageAmount,
        creditsConsumed: amount,
        details: input.details ?? {},
        createdAt,
      }
      this.usageOverageEvents.push(overageEvent)
    }
    const balance = await this.getUsageCreditBalance(input.orgId)
    return { balance: balance ?? creditBalance(input.orgId, existing.totalCredits, existing.usedCredits + amount), overageEvent: overageEvent ? { ...overageEvent, details: { ...overageEvent.details } } : undefined }
  }

  async listUsageCreditGrants(limit = 50): Promise<UsageCreditGrantRecord[]> {
    return [...this.usageCreditGrants]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 100)))
      .map(grant => ({ ...grant }))
  }

  async listUsageOverageEvents(orgId: string): Promise<UsageOverageEventRecord[]> {
    return this.usageOverageEvents
      .filter(event => event.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(event => ({ ...event, details: { ...event.details } }))
  }

  async upsertStripeInfo(input: UpsertStripeInfoInput): Promise<StripeInfoRecord> {
    const existing = this.stripeInfo.get(input.customerId)
    const record: StripeInfoRecord = {
      customerId: input.customerId,
      status: input.status ?? existing?.status ?? null,
      isGoodPlan: input.isGoodPlan ?? existing?.isGoodPlan ?? null,
      planCalculatedAt: input.planCalculatedAt ?? existing?.planCalculatedAt ?? null,
    }
    this.stripeInfo.set(record.customerId, record)
    return { ...record }
  }

  async getStripeInfoByCustomerId(customerId: string): Promise<StripeInfoRecord | undefined> {
    const record = this.stripeInfo.get(customerId)
    return record ? { ...record } : undefined
  }

  async markAppStatsRefreshed(appId: string, refreshedAt = nowIso()): Promise<AppRecord | undefined> {
    const existing = this.apps.get(appId)
    if (!existing)
      return undefined
    const app = { ...existing, statsUpdatedAt: refreshedAt }
    this.apps.set(appId, app)
    return { ...app, transferHistory: app.transferHistory ? [...app.transferHistory] : [] }
  }

  async markOrgStatsRefreshed(orgId: string, refreshedAt = nowIso()): Promise<OrganizationRecord | undefined> {
    const existing = this.organizations.get(orgId)
    if (!existing)
      return undefined
    const org = { ...existing, lastStatsUpdatedAt: existing.statsUpdatedAt ?? existing.lastStatsUpdatedAt ?? null, statsUpdatedAt: refreshedAt }
    this.organizations.set(orgId, org)
    return { ...org }
  }

  async markStripePlanCalculated(customerId: string, calculatedAt = nowIso()): Promise<StripeInfoRecord | undefined> {
    const existing = this.stripeInfo.get(customerId)
    if (!existing)
      return undefined
    const record = { ...existing, planCalculatedAt: calculatedAt }
    this.stripeInfo.set(customerId, record)
    return { ...record }
  }
  async listApps(): Promise<AppRecord[]> {
    return Array.from(this.apps.values()).map((app) => ({ ...app, transferHistory: app.transferHistory ? [...app.transferHistory] : [] })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async transferApp(appId: string, newOwnerOrg: string): Promise<AppRecord | undefined> {
    const existing = this.apps.get(appId)
    if (!existing)
      return undefined
    const transferredAt = nowIso()
    const app = {
      ...existing,
      ownerOrg: newOwnerOrg,
      transferHistory: [...(existing.transferHistory ?? []), { fromOrg: existing.ownerOrg ?? null, toOrg: newOwnerOrg, transferredAt }],
    }
    this.apps.set(appId, app)
    for (const [key, release] of this.releases) {
      if (release.appId === appId)
        this.releases.set(key, { ...release, ownerOrg: newOwnerOrg })
    }
    return { ...app, transferHistory: [...app.transferHistory] }
  }

  async deleteApp(appId: string): Promise<boolean> {
    const deleted = this.apps.delete(appId)
    for (const key of this.releases.keys()) {
      if (key.startsWith(`${appId}:`))
        this.releases.delete(key)
    }
    for (const key of this.channels.keys()) {
      if (key.startsWith(`${appId}:`))
        this.channels.delete(key)
    }
    for (const key of this.devices.keys()) {
      if (key.startsWith(`${appId}:`))
        this.devices.delete(key)
    }
    for (const key of this.deviceChannels.keys()) {
      if (key.startsWith(`${appId}:`))
        this.deviceChannels.delete(key)
    }
    for (let index = this.compatibilityEvents.length - 1; index >= 0; index -= 1) {
      if (this.compatibilityEvents[index].app_id === appId)
        this.compatibilityEvents.splice(index, 1)
    }
    return deleted
  }

  async upsertSsoProvider(provider: Pick<SsoProviderRecord, 'providerId' | 'orgId'> & Partial<SsoProviderRecord>): Promise<SsoProviderRecord> {
    const existing = this.ssoProviders.get(provider.providerId)
    const record: SsoProviderRecord = {
      providerId: provider.providerId,
      orgId: provider.orgId,
      domain: provider.domain,
      enabled: provider.enabled ?? existing?.enabled ?? true,
      enforceSso: provider.enforceSso ?? existing?.enforceSso ?? false,
      createdAt: existing?.createdAt ?? provider.createdAt ?? nowIso(),
    }
    this.ssoProviders.set(provider.providerId, record)
    return { ...record }
  }

  async getSsoProvider(providerId: string): Promise<SsoProviderRecord | undefined> {
    const provider = this.ssoProviders.get(providerId)
    return provider ? { ...provider } : undefined
  }

  async provisionSsoUser(input: SsoProvisionInput): Promise<SsoProvisionResult | undefined> {
    const provider = this.ssoProviders.get(input.providerId)
    if ((!provider || !provider.enabled) && !input.orgId)
      return undefined
    const orgId = input.orgId ?? provider!.orgId
    if (input.orgId && !provider)
      await this.upsertSsoProvider({ providerId: input.providerId, orgId })

    const existingUser = this.users.get(input.userId)
    const existingMembership = this.orgUsers.get(this.orgUserKey(input.userId, orgId))
    const now = nowIso()
    this.users.set(input.userId, {
      id: input.userId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      createdAt: existingUser?.createdAt ?? now,
      updatedAt: now,
    })
    if (!existingMembership) {
      this.orgUsers.set(this.orgUserKey(input.userId, orgId), {
        userId: input.userId,
        orgId,
        role: 'read',
        createdAt: now,
      })
    }
    return { success: true, merged: false, alreadyMember: !!existingMembership, orgId, userId: input.userId }
  }

  async createPendingInvitation(input: CreatePendingInvitationInput): Promise<PendingInvitationRecord> {
    const existing = this.pendingInvitations.get(input.inviteMagicString)
    const record: PendingInvitationRecord = {
      inviteMagicString: input.inviteMagicString,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      futureUuid: input.futureUuid,
      orgId: input.orgId,
      role: input.role,
      cancelledAt: input.cancelledAt ?? null,
      createdAt: existing?.createdAt ?? nowIso(),
    }
    this.pendingInvitations.set(record.inviteMagicString, record)
    return { ...record }
  }

  async getPendingInvitation(inviteMagicString: string): Promise<PendingInvitationRecord | undefined> {
    const invitation = this.pendingInvitations.get(inviteMagicString)
    return invitation ? { ...invitation } : undefined
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult | undefined> {
    const invitation = this.pendingInvitations.get(input.magicInviteString)
    if (!invitation || invitation.cancelledAt)
      return undefined
    const now = nowIso()
    this.users.set(invitation.futureUuid, {
      id: invitation.futureUuid,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      createdAt: this.users.get(invitation.futureUuid)?.createdAt ?? now,
      updatedAt: now,
    })
    const role = legacyInviteRole(invitation.role)
    this.orgUsers.set(this.orgUserKey(invitation.futureUuid, invitation.orgId), {
      userId: invitation.futureUuid,
      orgId: invitation.orgId,
      role,
      createdAt: this.orgUsers.get(this.orgUserKey(invitation.futureUuid, invitation.orgId))?.createdAt ?? now,
    })
    this.pendingInvitations.delete(input.magicInviteString)
    return { success: true, userId: invitation.futureUuid, orgId: invitation.orgId, role }
  }

  async recordBuildTime(input: RecordBuildTimeInput): Promise<BuildLogRecord> {
    const billableSeconds = billableBuildSeconds(input.platform, input.buildTimeUnit)
    const existing = this.buildLogs.get(input.buildId)
    const now = nowIso()
    const record: BuildLogRecord = {
      buildId: input.buildId,
      orgId: input.orgId,
      userId: input.userId,
      appId: input.appId,
      platform: input.platform,
      buildTimeUnit: input.buildTimeUnit,
      billableSeconds,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.buildLogs.set(input.buildId, record)
    return { ...record }
  }

  async listBuildLogsByOrg(orgId: string): Promise<BuildLogRecord[]> {
    return [...this.buildLogs.values()]
      .filter(log => log.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(log => ({ ...log }))
  }

  async getDailyBuildTime(appId: string, date: string): Promise<BuildTimeMetricsRecord | undefined> {
    const logs = [...this.buildLogs.values()].filter((log) => log.appId === appId && buildTimeDateId(new Date(log.createdAt)) === date)
    if (logs.length === 0)
      return undefined
    return {
      appId,
      date,
      buildTimeUnit: logs.reduce((sum, log) => sum + log.billableSeconds, 0),
      buildCount: logs.length,
    }
  }

  async listDailyBuildTimeByOrg(orgId: string): Promise<BuildTimeMetricsRecord[]> {
    const appIds = new Set([...this.apps.values()].filter(app => app.ownerOrg === orgId).map(app => app.appId))
    const byKey = new Map<string, BuildTimeMetricsRecord>()
    for (const log of this.buildLogs.values()) {
      if (!appIds.has(log.appId))
        continue
      const date = buildTimeDateId(new Date(log.createdAt))
      const key = `${log.appId}:${date}`
      const existing = byKey.get(key)
      byKey.set(key, {
        appId: log.appId,
        date,
        buildTimeUnit: (existing?.buildTimeUnit ?? 0) + log.billableSeconds,
        buildCount: (existing?.buildCount ?? 0) + 1,
      })
    }
    return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date))
  }

  async recordMauUsage(input: RecordMauUsageInput): Promise<MauMetricsRecord> {
    const record: MauMetricsRecord = {
      appId: input.appId,
      date: input.date,
      mau: Math.max(0, Math.ceil(input.mau)),
    }
    this.dailyMau.set(`${input.appId}:${input.date}`, record)
    return { ...record }
  }

  async listDailyMauByOrg(orgId: string): Promise<MauMetricsRecord[]> {
    const appIds = new Set([...this.apps.values()].filter(app => app.ownerOrg === orgId).map(app => app.appId))
    return [...this.dailyMau.values()]
      .filter(record => appIds.has(record.appId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(record => ({ ...record }))
  }

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const needle = email.trim().toLowerCase()
    const user = Array.from(this.users.values()).find(record => record.email.toLowerCase() === needle)
    return user ? { ...user } : undefined
  }

  async getUser(userId: string): Promise<UserRecord | undefined> {
    const user = this.users.get(userId)
    return user ? { ...user } : undefined
  }

  async getOrgMembership(userId: string, orgId: string): Promise<OrgMembershipRecord | undefined> {
    const membership = this.orgUsers.get(this.orgUserKey(userId, orgId))
    return membership ? { ...membership } : undefined
  }
  async listApiKeys(): Promise<ApiKeyRecord[]> {
    return Array.from(this.apiKeys.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getApiKey(id: number): Promise<ApiKeyRecord | undefined> {
    const record = this.apiKeys.get(id)
    return record ? { ...record, bindings: [...record.bindings], globalPermissions: [...record.globalPermissions] } : undefined
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | undefined> {
    return Array.from(this.apiKeys.values()).find((record) => record.keyHash === keyHash)
  }

  async createApiKey(input: CreateApiKeyInput): Promise<ApiKeyRecord> {
    const now = nowIso()
    const record: ApiKeyRecord = {
      id: this.nextApiKeyId++,
      name: input.name,
      keyHash: input.keyHash,
      rbacId: crypto.randomUUID(),
      bindings: [...input.bindings],
      globalPermissions: [...input.globalPermissions ?? []],
      expiresAt: input.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.apiKeys.set(record.id, record)
    return { ...record, bindings: [...record.bindings], globalPermissions: [...record.globalPermissions] }
  }

  async updateApiKey(id: number, input: UpdateApiKeyInput): Promise<ApiKeyRecord | undefined> {
    const existing = this.apiKeys.get(id)
    if (!existing)
      return undefined
    const record: ApiKeyRecord = {
      ...existing,
      name: input.name ?? existing.name,
      keyHash: input.keyHash ?? existing.keyHash,
      bindings: input.bindings ? [...input.bindings] : [...existing.bindings],
      globalPermissions: input.globalPermissions ? [...input.globalPermissions] : [...existing.globalPermissions],
      expiresAt: Object.prototype.hasOwnProperty.call(input, 'expiresAt') ? input.expiresAt ?? null : existing.expiresAt,
      updatedAt: nowIso(),
    }
    this.apiKeys.set(id, record)
    return { ...record, bindings: [...record.bindings], globalPermissions: [...record.globalPermissions] }
  }

  async createBuildRequest(input: CreateBuildRequestInput): Promise<BuildRequestRecord> {
    const now = nowIso()
    const record: BuildRequestRecord = {
      id: input.id ?? crypto.randomUUID(),
      appId: input.appId,
      ownerOrg: input.ownerOrg,
      requestedBy: input.requestedBy,
      platform: input.platform,
      buildMode: input.buildMode,
      status: input.status ?? 'pending',
      builderJobId: input.builderJobId,
      createdAt: now,
      updatedAt: now,
    }
    this.buildRequests.set(record.builderJobId, record)
    return { ...record }
  }

  async getBuildRequestByJobId(jobId: string): Promise<BuildRequestRecord | undefined> {
    const record = this.buildRequests.get(jobId)
    return record ? { ...record } : undefined
  }

  async updateBuildRequestStatus(jobId: string, status: string): Promise<BuildRequestRecord | undefined> {
    const existing = this.buildRequests.get(jobId)
    if (!existing)
      return undefined
    const record = { ...existing, status, updatedAt: nowIso() }
    this.buildRequests.set(jobId, record)
    return { ...record }
  }

  async deleteApiKey(id: number): Promise<boolean> {
    return this.apiKeys.delete(id)
  }
  async recordAuditLog(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      id: this.nextAuditLogId++,
      createdAt: nowIso(),
      tableName: input.tableName,
      recordId: input.recordId,
      operation: input.operation,
      userId: input.userId ?? null,
      orgId: input.orgId,
      oldRecord: input.oldRecord ?? null,
      newRecord: input.newRecord ?? null,
      changedFields: input.changedFields ?? null,
    }
    this.auditLogs.push(record)
    return { ...record, changedFields: record.changedFields ? [...record.changedFields] : null }
  }

  async listAuditLogs(query: ListAuditLogsQuery): Promise<ListAuditLogsResult> {
    const filtered = this.auditLogs
      .filter((record) => record.orgId === query.orgId)
      .filter((record) => !query.tableName || record.tableName === query.tableName)
      .filter((record) => !query.operation || record.operation === query.operation)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    const start = query.page * query.limit
    return {
      data: filtered.slice(start, start + query.limit).map((record) => ({ ...record, changedFields: record.changedFields ? [...record.changedFields] : null })),
      total: filtered.length,
      page: query.page,
      limit: query.limit,
    }
  }



  async createRelease(input: CreateReleaseInput): Promise<ReleaseRecord> {
    let app = this.apps.get(input.appId)
    if (!app)
      app = await this.createApp(input.appId, input.appId)
    await this.upsertChannel({ appId: input.appId, name: input.channel, public: input.channel === 'production', allowSelfSet: true })

    const path = `apps/${input.appId}/${input.platform}/${input.channel}/${input.version}/bundle.zip`
    const release: ReleaseRecord = {
      appId: input.appId,
      version: input.version,
      sessionKey: input.sessionKey ?? null,
      keyId: input.keyId ?? null,
      platform: input.platform,
      channel: input.channel,
      path,
      checksum: input.checksum,
      size: input.size,
      manifest: input.manifest ?? [],
      mandatory: input.mandatory,
      nativePackages: input.nativePackages ?? [],
      rollout: input.rollout,
      notes: input.notes,
      minUpdateVersion: input.minUpdateVersion ?? null,
      ownerOrg: app.ownerOrg,
      createdAt: nowIso(),
    }
    this.releases.set(this.releaseKey(input.appId, input.platform, input.channel, input.version), release)
    this.bundles.set(path, { bytes: new Uint8Array(input.bytes), checksum: input.checksum })
    return release
  }

  async listReleases(appId: string): Promise<ReleaseRecord[]> {
    return sortReleasesNewestFirst(Array.from(this.releases.values()).filter((release) => release.appId === appId))
  }

  async upsertVersionMeta(input: UpsertVersionMetaInput): Promise<boolean> {
    if (input.size === 0)
      return false
    if (!this.apps.has(input.appId))
      return false
    const releases = await this.listReleases(input.appId)
    if (!releases[input.versionId - 1])
      return false
    const sameSignExists = this.versionMeta.some((row) => {
      if (row.appId !== input.appId || row.versionId !== input.versionId)
        return false
      return input.size > 0 ? row.size > 0 : row.size < 0
    })
    if (sameSignExists)
      return false
    this.versionMeta.push({ appId: input.appId, versionId: input.versionId, size: input.size, createdAt: nowIso() })
    return true
  }

  async deleteReleases(appId: string, version?: string): Promise<boolean> {
    const keys: string[] = []
    for (const [key, release] of this.releases) {
      if (release.appId === appId && (!version || release.version === version))
        keys.push(key)
    }
    for (const key of keys) {
      const release = this.releases.get(key)
      if (release)
        this.bundles.delete(release.path)
      this.releases.delete(key)
    }
    return keys.length > 0
  }

  async listChannels(appId: string, platform?: Platform): Promise<ChannelRecord[]> {
    const explicit = Array.from(this.channels.values()).filter((channel) => channel.id.startsWith(`${appId}:`))
    const releases = Array.from(this.releases.values()).filter((release) => release.appId === appId && (!platform || release.platform === platform))
    return mergeChannels(explicit.map((channel) => ({ ...channel, id: channel.name })), releases)
  }
  async upsertChannel(input: UpsertChannelInput): Promise<ChannelRecord> {
    const row = channelRow(input)
    const record = toChannel(row)
    if (row.public === 1) {
      for (const [key, channel] of this.channels) {
        if (key.startsWith(`${input.appId}:`) && channel.name !== input.name && channel.public && publicChannelsOverlap(row, channelRow({ appId: input.appId, name: channel.name, public: channel.public, allowSelfSet: channel.allowSelfSet, ios: channel.ios, android: channel.android, electron: channel.electron })))
          this.channels.set(key, { ...channel, public: false })
      }
    }
    this.channels.set(this.channelKey(input.appId, input.name), { ...record, id: this.channelKey(input.appId, input.name) })
    return record
  }

  async deleteChannel(appId: string, channel: string): Promise<boolean> {
    const existed = this.channels.delete(this.channelKey(appId, channel))
    let removedRelease = false
    for (const [key, release] of this.releases) {
      if (release.appId === appId && release.channel === channel) {
        this.releases.delete(key)
        this.bundles.delete(release.path)
        removedRelease = true
      }
    }
    for (const [key, value] of this.deviceChannels) {
      if (key.startsWith(`${appId}:`) && value === channel)
        this.deviceChannels.delete(key)
    }
    return existed || removedRelease
  }

  async getRelease(appId: string, platform: Platform, channel: string, version: string): Promise<ReleaseRecord | undefined> {
    return this.releases.get(this.releaseKey(appId, platform, channel, version))
  }

  async findLatestRelease(appId: string, platform: Platform, channel: string): Promise<ReleaseRecord | undefined> {
    return sortReleasesNewestFirst(Array.from(this.releases.values()).filter((release) => {
      return release.appId === appId && release.platform === platform && release.channel === channel
    }))[0]
  }

  async getBundle(release: ReleaseRecord): Promise<BundleObject | undefined> {
    const bundle = this.bundles.get(release.path)
    if (!bundle)
      return undefined
    const body = new ArrayBuffer(bundle.bytes.byteLength)
    new Uint8Array(body).set(bundle.bytes)
    return {
      body: new Response(body).body,
      contentType: 'application/zip',
      size: bundle.bytes.byteLength,
      checksum: bundle.checksum,
    }
  }
  async listDevices(appId: string): Promise<DeviceRecord[]> {
    return Array.from(this.devices.values())
      .filter((device) => device.appId === appId)
      .map((device) => ({ ...device, channel: this.deviceChannels.get(this.deviceChannelKey(appId, device.deviceId)) }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getDevice(appId: string, deviceId: string): Promise<DeviceRecord | undefined> {
    const device = this.devices.get(this.deviceKey(appId, deviceId))
    return device ? { ...device, channel: this.deviceChannels.get(this.deviceChannelKey(appId, deviceId)) } : undefined
  }

  async upsertDevice(input: UpsertDeviceInput): Promise<DeviceRecord> {
    const existing = this.devices.get(this.deviceKey(input.appId, input.deviceId))
    const device: DeviceRecord = {
      appId: input.appId,
      deviceId: input.deviceId,
      platform: input.platform ?? existing?.platform,
      keyId: input.keyId ?? existing?.keyId,
      pluginVersion: input.pluginVersion ?? existing?.pluginVersion,
      osVersion: input.osVersion ?? existing?.osVersion,
      versionBuild: input.versionBuild ?? existing?.versionBuild,
      versionName: input.versionName ?? existing?.versionName,
      customId: input.customId ?? existing?.customId,
      isProd: input.isProd ?? existing?.isProd,
      isEmulator: input.isEmulator ?? existing?.isEmulator,
      defaultChannel: Object.hasOwn(input, 'defaultChannel') ? input.defaultChannel ?? undefined : existing?.defaultChannel,
      updatedAt: nowIso(),
    }
    this.devices.set(this.deviceKey(input.appId, input.deviceId), device)
    if (input.channel)
      await this.setDeviceChannel(input.appId, input.deviceId, input.channel)
    return { ...device, channel: this.deviceChannels.get(this.deviceChannelKey(input.appId, input.deviceId)) }
  }

  async deleteDevice(appId: string, deviceId: string): Promise<boolean> {
    await this.clearDeviceChannel(appId, deviceId)
    return this.devices.delete(this.deviceKey(appId, deviceId))
  }

  async getDeviceChannel(appId: string, deviceId: string): Promise<string | undefined> {
    return this.deviceChannels.get(this.deviceChannelKey(appId, deviceId))
  }

  async setDeviceChannel(appId: string, deviceId: string, channel: string): Promise<void> {
    this.deviceChannels.set(this.deviceChannelKey(appId, deviceId), channel)
  }

  async clearDeviceChannel(appId: string, deviceId: string): Promise<void> {
    this.deviceChannels.delete(this.deviceChannelKey(appId, deviceId))
  }

  async recordStats(event: StatsEvent): Promise<void> {
    this.stats.push({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined })
  }

  async listStatsEvents(query: ListStatsEventsQuery): Promise<StatsEventRecord[]> {
    const limit = Math.min(query.limit ?? 100, 1000)
    const start = query.start_date ? Date.parse(query.start_date) : undefined
    const end = query.end_date ? Date.parse(query.end_date) : undefined
    const search = query.search?.toLowerCase()
    return this.stats
      .map((event, index) => ({
        ...event,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      }))
      .filter(event => event.app_id === query.appId)
      .filter(event => !query.actions?.length || query.actions.includes(event.action))
      .filter(event => !query.devicesId?.length || query.devicesId.includes(event.device_id))
      .filter(event => start === undefined || Date.parse(event.created_at) >= start)
      .filter(event => end === undefined || Date.parse(event.created_at) <= end)
      .filter(event => !search || [event.device_id, event.version_name, event.action].some(value => value.toLowerCase().includes(search)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
  }

  async recordEvent(event: ConsoleEvent): Promise<void> {
    this.events.push(event)
  }

  async createCompatibilityEvent(input: CreateCompatibilityEventInput): Promise<StoredCompatibilityEvent> {
    const existing = this.compatibilityEvents.find(event => {
      return event.app_id === input.app_id
        && event.channel_id === input.channel_id
        && event.platform === input.platform
        && event.current_version_id === input.current_version_id
        && event.previous_version_id === input.previous_version_id
        && event.change_occurred_at === input.change_occurred_at
    })
    if (existing) {
      Object.assign(existing, input)
      return { ...existing, offenders: [...existing.offenders] }
    }
    const event: StoredCompatibilityEvent = {
      id: this.compatibilityEvents.length + 1,
      created_at: nowIso(),
      resolved_at: null,
      resolved_by: null,
      resolution_kind: null,
      resolution_note: null,
      ...input,
      offenders: [...input.offenders],
    }
    this.compatibilityEvents.push(event)
    return { ...event, offenders: [...event.offenders] }
  }

  async createWebhook(input: CreateWebhookInput): Promise<WebhookRecord> {
    const now = nowIso()
    const record: WebhookRecord = {
      id: crypto.randomUUID(),
      orgId: input.orgId,
      name: input.name,
      url: input.url,
      secret: generateWebhookSecret(),
      enabled: input.enabled ?? true,
      events: [...input.events],
      deliveryVersion: input.deliveryVersion,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.webhooks.set(record.id, record)
    return { ...record, events: [...record.events] }
  }

  async getWebhook(webhookId: string): Promise<WebhookRecord | undefined> {
    const webhook = this.webhooks.get(webhookId)
    if (!webhook)
      return undefined
    return { ...webhook, events: [...webhook.events] }
  }

  async listWebhooks(orgId: string, page: number, perPage: number): Promise<WebhookRecord[]> {
    return [...this.webhooks.values()]
      .filter(webhook => webhook.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(page * perPage, page * perPage + perPage)
      .map((webhook) => {
        const { secret: _secret, ...publicWebhook } = webhook
        return { ...publicWebhook, events: [...webhook.events] }
      })
  }

  async updateWebhook(webhookId: string, input: UpdateWebhookInput): Promise<WebhookRecord | undefined> {
    const existing = this.webhooks.get(webhookId)
    if (!existing)
      return undefined
    const updated: WebhookRecord = {
      ...existing,
      name: input.name ?? existing.name,
      url: input.url ?? existing.url,
      events: input.events ? [...input.events] : [...existing.events],
      enabled: input.enabled ?? existing.enabled,
      deliveryVersion: input.deliveryVersion ?? existing.deliveryVersion,
      updatedAt: nowIso(),
    }
    this.webhooks.set(webhookId, updated)
    const { secret: _secret, ...publicWebhook } = updated
    return { ...publicWebhook, events: [...updated.events] }
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    const deleted = this.webhooks.delete(webhookId)
    for (const [deliveryId, delivery] of this.webhookDeliveries) {
      if (delivery.webhookId === webhookId)
        this.webhookDeliveries.delete(deliveryId)
    }
    return deleted
  }

  async getWebhookStats(webhookId: string, sinceIso: string): Promise<WebhookStatsRecord> {
    const stats: WebhookStatsRecord = { success: 0, failed: 0, pending: 0 }
    for (const delivery of this.webhookDeliveries.values()) {
      if (delivery.webhookId === webhookId && delivery.createdAt >= sinceIso)
        stats[delivery.status] += 1
    }
    return stats
  }

  async createWebhookDelivery(input: CreateWebhookDeliveryInput): Promise<WebhookDeliveryRecord> {
    const record: WebhookDeliveryRecord = {
      id: input.id ?? crypto.randomUUID(),
      webhookId: input.webhookId,
      orgId: input.orgId,
      auditLogId: input.auditLogId ?? null,
      eventType: input.eventType,
      status: input.status ?? 'pending',
      requestPayload: { ...input.requestPayload },
      responseStatus: input.responseStatus ?? null,
      responseBody: input.responseBody ?? null,
      responseHeaders: input.responseHeaders ? { ...input.responseHeaders } : null,
      attemptCount: input.attemptCount ?? 0,
      maxAttempts: input.maxAttempts ?? 10,
      nextRetryAt: null,
      createdAt: nowIso(),
      completedAt: null,
      durationMs: null,
      deliveryVersion: input.deliveryVersion,
    }
    this.webhookDeliveries.set(record.id, record)
    return { ...record, requestPayload: { ...record.requestPayload }, responseHeaders: record.responseHeaders ? { ...record.responseHeaders } : null }
  }

  async getWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryRecord | undefined> {
    const delivery = this.webhookDeliveries.get(deliveryId)
    return delivery ? { ...delivery, requestPayload: { ...delivery.requestPayload }, responseHeaders: delivery.responseHeaders ? { ...delivery.responseHeaders } : null } : undefined
  }

  async updateWebhookDelivery(deliveryId: string, input: UpdateWebhookDeliveryInput): Promise<WebhookDeliveryRecord | undefined> {
    const existing = this.webhookDeliveries.get(deliveryId)
    if (!existing)
      return undefined
    const updated: WebhookDeliveryRecord = {
      ...existing,
      status: input.status ?? existing.status,
      responseStatus: Object.hasOwn(input, 'responseStatus') ? input.responseStatus ?? null : existing.responseStatus,
      responseBody: Object.hasOwn(input, 'responseBody') ? input.responseBody ?? null : existing.responseBody,
      responseHeaders: Object.hasOwn(input, 'responseHeaders') ? input.responseHeaders ? { ...input.responseHeaders } : null : existing.responseHeaders,
      attemptCount: input.attemptCount ?? existing.attemptCount,
      nextRetryAt: Object.hasOwn(input, 'nextRetryAt') ? input.nextRetryAt ?? null : existing.nextRetryAt,
      completedAt: Object.hasOwn(input, 'completedAt') ? input.completedAt ?? null : existing.completedAt,
      durationMs: Object.hasOwn(input, 'durationMs') ? input.durationMs ?? null : existing.durationMs,
    }
    this.webhookDeliveries.set(deliveryId, updated)
    return { ...updated, requestPayload: { ...updated.requestPayload }, responseHeaders: updated.responseHeaders ? { ...updated.responseHeaders } : null }
  }

  async listWebhookDeliveries(query: ListWebhookDeliveriesQuery): Promise<ListWebhookDeliveriesResult> {
    const filtered = [...this.webhookDeliveries.values()]
      .filter(delivery => delivery.webhookId === query.webhookId)
      .filter(delivery => !query.status || delivery.status === query.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      deliveries: filtered.slice(query.page * query.perPage, query.page * query.perPage + query.perPage).map(delivery => ({
        ...delivery,
        requestPayload: { ...delivery.requestPayload },
        responseHeaders: delivery.responseHeaders ? { ...delivery.responseHeaders } : null,
      })),
      total: filtered.length,
    }
  }

  async getCompatibilityEvent(id: number): Promise<StoredCompatibilityEvent | undefined> {
    const event = this.compatibilityEvents.find(item => item.id === id)
    return event ? { ...event, offenders: [...event.offenders] } : undefined
  }

  async listCompatibilityEvents(appId: string): Promise<StoredCompatibilityEvent[]> {
    return this.compatibilityEvents
      .filter(event => event.app_id === appId)
      .map(event => ({ ...event, offenders: [...event.offenders] }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
  }

  async acknowledgeCompatibilityEvent(input: AcknowledgeCompatibilityEventInput): Promise<StoredCompatibilityEvent | undefined> {
    const event = this.compatibilityEvents.find(item => item.id === input.id)
    if (!event)
      return undefined
    if (!event.resolved_at) {
      event.resolved_at = nowIso()
      event.resolved_by = input.resolvedBy ?? null
      event.resolution_kind = 'accepted'
      event.resolution_note = input.note
    }
    return { ...event, offenders: [...event.offenders] }
  }

  private releaseKey(appId: string, platform: Platform, channel: string, version: string) {
    return `${appId}:${platform}:${channel}:${version}`
  }

  private channelKey(appId: string, channel: string) {
    return `${appId}:${channel}`
  }

  private deviceKey(appId: string, deviceId: string) {
    return `${appId}:${deviceId}`
  }

  private deviceChannelKey(appId: string, deviceId: string) {
    return `${appId}:${deviceId}`
  }

  private orgUserKey(userId: string, orgId: string) {
    return `${userId}:${orgId}`
  }
}
