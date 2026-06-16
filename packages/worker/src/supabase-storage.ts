import type { AcceptInvitationInput, AcceptInvitationResult, ApiKeyBindingRecord, ApiKeyRecord, AppRecord, AuditLogRecord, AuditOperation, ChannelRecord, ConsoleEvent, CreatePendingInvitationInput, DeviceRecord, OrganizationRecord, PendingInvitationRecord, Platform, ReleaseRecord, SsoProviderRecord, SsoProvisionInput, SsoProvisionResult, StatsEvent, UserRecord } from '@codepushgo/shared'
import type { StoredCompatibilityEvent } from './compatibility-events'
import type { AcknowledgeCompatibilityEventInput, BuildLogRecord, BuildRequestRecord, BuildTimeMetricsRecord, BundleObject, ChannelPermissionOverrideRecord, ConsumeUsageCreditsInput, CreateApiKeyInput, CreateAuditLogInput, CreateBuildRequestInput, CreateCompatibilityEventInput, CreateReleaseInput, CreateRoleBindingInput, CreateWebhookDeliveryInput, CreateWebhookInput, Env, GrantUsageCreditsInput, ListAuditLogsQuery, ListAuditLogsResult, ListStatsEventsQuery, ListWebhookDeliveriesQuery, ListWebhookDeliveriesResult, MauMetricsRecord, OrgMemberRecord, OrgMembershipRecord, RecordBuildTimeInput, RecordMauUsageInput, RoleBindingPrincipalType, RoleBindingRecord, RoleBindingScopeType, StatsEventRecord, StorageDriver, StripeInfoRecord, UpdateApiKeyInput, UpdateRoleBindingInput, UpdateWebhookDeliveryInput, UpdateWebhookInput, UpsertChannelInput, UpsertDeviceInput, UpsertOrganizationInput, UpsertStripeInfoInput, UpsertVersionMetaInput, UsageCreditBalanceRecord, UsageCreditGrantRecord, UsageCreditMetric, UsageOverageEventRecord, WebhookDeliveryRecord, WebhookDeliveryStatus, WebhookRecord, WebhookStatsRecord } from './storage'
import { compareVersions } from '@codepushgo/shared'
import { findMatchingUsageOverageEvent, shouldCreateUsageOverageEvent } from './overage-tracking'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface AppRow {
  app_id: string
  name: string
  owner_org: string | null
  expose_metadata: boolean | null
  transfer_history: Array<{ fromOrg: string | null, toOrg: string, transferredAt: string }> | null
  stats_updated_at: string | null
  stats_refresh_requested_at: string | null
  created_at: string
}

interface OrganizationRow {
  id: string
  name: string
  management_email: string | null
  created_by: string | null
  customer_id: string | null
  password_policy_config: Record<string, unknown> | null
  enforce_encrypted_bundles: boolean | null
  required_encryption_key: string | null
  stats_updated_at: string | null
  last_stats_updated_at: string | null
  stats_refresh_requested_at: string | null
  website: string | null
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
  path: string
  checksum: string
  session_key: string | null
  key_id: string | null
  size: number
  mandatory: boolean
  rollout: number
  notes: string | null
  min_update_version: string | null
  native_packages: unknown
  owner_org: string | null
  created_at: string
}

interface ChannelRow {
  app_id: string
  name: string
  public: boolean
  allow_self_set: boolean
  ios: boolean | null
  android: boolean | null
  electron: boolean | null
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
  is_prod: boolean | null
  is_emulator: boolean | null
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


interface RoleBindingStorageRow {
  id: string
  principal_type: RoleBindingPrincipalType
  principal_id: string
  role_name: string
  scope_type: RoleBindingScopeType
  org_id: string
  app_id: string | null
  channel_id: string | null
  reason: string | null
  is_direct: boolean | null
  created_at: string
  updated_at: string
}

interface ChannelPermissionOverrideStorageRow {
  principal_type: RoleBindingPrincipalType
  principal_id: string
  channel_id: string
  permission_key: string
  is_allowed: boolean
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
  offenders: string[] | null
  change_occurred_at: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_kind: string | null
  resolution_note: string | null
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
  old_record: unknown
  new_record: unknown
  changed_fields: string[] | null
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
  enabled: boolean
  enforce_sso: boolean
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
  details: Record<string, unknown> | null
  created_at: string
}


interface WebhookRow {
  id: string
  org_id: string
  name: string
  url: string
  secret: string | null
  enabled: boolean
  events: string[] | null
  delivery_version: 'legacy' | 'standard' | null
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
  request_payload: Record<string, unknown>
  response_status: number | null
  response_body: string | null
  response_headers: Record<string, unknown> | null
  attempt_count: number
  max_attempts: number
  next_retry_at: string | null
  created_at: string
  completed_at: string | null
  duration_ms: number | null
  delivery_version: 'legacy' | 'standard' | null
}

interface StripeInfoRow {
  customer_id: string
  status: string | null
  is_good_plan: boolean | null
  plan_calculated_at: string | null
}

function nowIso() {
  return new Date().toISOString()
}

function toApp(row: AppRow): AppRecord {
  return {
    ownerOrg: row.owner_org ?? undefined,
    exposeMetadata: row.expose_metadata ?? false,
    statsUpdatedAt: row.stats_updated_at ?? null,
    statsRefreshRequestedAt: row.stats_refresh_requested_at ?? null,
    transferHistory: row.transfer_history ?? [],
    appId: row.app_id,
    name: row.name,
    createdAt: row.created_at,
  }
}

function generateWebhookSecret() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return `whsec_${btoa(binary)}`
}

function toWebhook(row: WebhookRow, includeSecret = false): WebhookRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    url: row.url,
    ...(includeSecret && row.secret ? { secret: row.secret } : {}),
    enabled: row.enabled,
    events: row.events ?? [],
    deliveryVersion: row.delivery_version ?? 'legacy',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toWebhookDelivery(row: WebhookDeliveryRow): WebhookDeliveryRecord {
  return {
    id: row.id,
    webhookId: row.webhook_id,
    orgId: row.org_id,
    auditLogId: row.audit_log_id,
    eventType: row.event_type,
    status: row.status,
    requestPayload: row.request_payload ?? {},
    responseStatus: row.response_status,
    responseBody: row.response_body,
    responseHeaders: row.response_headers,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    deliveryVersion: row.delivery_version ?? 'legacy',
  }
}

function parseNativePackages(value: unknown): Array<{ name: string, version: string, ios_checksum?: string, android_checksum?: string }> {
  if (!Array.isArray(value))
    return []
  return value.filter((item): item is { name: string, version: string, ios_checksum?: string, android_checksum?: string } => {
    return typeof item === 'object' && item !== null && typeof item.name === 'string' && typeof item.version === 'string'
  })
}

function toOrganization(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    managementEmail: row.management_email ?? undefined,
    createdBy: row.created_by ?? undefined,
    enforceEncryptedBundles: row.enforce_encrypted_bundles ?? false,
    requiredEncryptionKey: row.required_encryption_key ?? null,
    statsUpdatedAt: row.stats_updated_at ?? null,
    lastStatsUpdatedAt: row.last_stats_updated_at ?? null,
    statsRefreshRequestedAt: row.stats_refresh_requested_at ?? null,
    website: row.website ?? undefined,
    passwordPolicyConfig: row.password_policy_config ?? null,
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


function buildTimeDateId(date = new Date()) {
  return date.toISOString().slice(0, 10)
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
    details: row.details ?? {},
    createdAt: row.created_at,
  }
}

function toStripeInfo(row: StripeInfoRow): StripeInfoRecord {
  return {
    customerId: row.customer_id,
    status: row.status,
    isGoodPlan: row.is_good_plan,
    planCalculatedAt: row.plan_calculated_at ?? null,
  }
}

function creditBalance(orgId: string, totalCredits: number, usedCredits: number): UsageCreditBalanceRecord {
  const total = Math.max(0, totalCredits)
  const used = Math.max(0, usedCredits)
  return { orgId, totalCredits: total, usedCredits: used, availableCredits: Math.max(0, total - used) }
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

function toRelease(row: ReleaseRow): ReleaseRecord {
  return {
    sessionKey: row.session_key ?? null,
    keyId: row.key_id ?? null,
    appId: row.app_id,
    version: row.version,
    platform: row.platform,
    channel: row.channel,
    path: row.path,
    checksum: row.checksum,
    size: Number(row.size),
    mandatory: row.mandatory,
    minUpdateVersion: row.min_update_version ?? null,
    nativePackages: parseNativePackages(row.native_packages),
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
    public: row.public,
    allowSelfSet: row.allow_self_set,
    ios: row.ios ?? undefined,
    android: row.android ?? undefined,
    electron: row.electron ?? undefined,
  }
}

function toDevice(row: DeviceRow, channel?: string): DeviceRecord {
  return {
    appId: row.app_id,
    deviceId: row.device_id,
    platform: row.platform ?? undefined,
    pluginVersion: row.plugin_version ?? undefined,
    osVersion: row.os_version ?? undefined,
    versionBuild: row.version_build ?? undefined,
    versionName: row.version_name ?? undefined,
    keyId: row.key_id ?? undefined,
    customId: row.custom_id ?? undefined,
    isProd: row.is_prod ?? undefined,
    isEmulator: row.is_emulator ?? undefined,
    defaultChannel: row.default_channel ?? undefined,
    channel,
    updatedAt: row.updated_at,
  }
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

function toSsoProvider(row: SsoProviderRow): SsoProviderRecord {
  return {
    providerId: row.provider_id,
    orgId: row.org_id,
    domain: row.domain ?? undefined,
    enabled: row.enabled,
    enforceSso: row.enforce_sso,
    createdAt: row.created_at,
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

function legacyInviteRole(role: string) {
  if (role.includes('super_admin'))
    return 'super_admin'
  if (role.includes('admin'))
    return 'admin'
  return 'read'
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

function toRoleBinding(row: RoleBindingStorageRow): RoleBindingRecord {
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
    isDirect: row.is_direct ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toChannelPermissionOverride(row: ChannelPermissionOverrideStorageRow): ChannelPermissionOverrideRecord {
  return {
    principalType: row.principal_type,
    principalId: row.principal_id,
    channelId: row.channel_id,
    permissionKey: row.permission_key,
    isAllowed: row.is_allowed,
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

function apiKeyBindingRow(apiKeyId: number, binding: ApiKeyBindingRecord) {
  return {
    apikey_id: apiKeyId,
    role_name: binding.roleName,
    scope_type: binding.scopeType,
    org_id: binding.orgId ?? null,
    app_id: binding.appId ?? null,
    reason: binding.reason ?? null,
  }
}
function channelPlatformFlags(channel: Pick<ChannelRow, 'ios' | 'android' | 'electron'>) {
  return {
    ios: channel.ios === true,
    android: channel.android === true,
    electron: channel.electron === true,
  }
}

function publicChannelsOverlap(a: Pick<ChannelRow, 'ios' | 'android' | 'electron'>, b: Pick<ChannelRow, 'ios' | 'android' | 'electron'>) {
  const left = channelPlatformFlags(a)
  const right = channelPlatformFlags(b)
  return (left.ios && right.ios) || (left.android && right.android) || (left.electron && right.electron)
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
    oldRecord: row.old_record,
    newRecord: row.new_record,
    changedFields: row.changed_fields,
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
    offenders: row.offenders ?? [],
    change_occurred_at: row.change_occurred_at,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    resolution_kind: row.resolution_kind,
    resolution_note: row.resolution_note,
  }
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

function mergeChannels(explicit: ChannelRecord[], releases: ReleaseRecord[]) {
  const merged = new Map<string, ChannelRecord>()
  for (const channel of explicit)
    merged.set(channel.name, channel)
  for (const channel of releaseChannels(releases))
    merged.set(channel.name, merged.get(channel.name) ?? channel)
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function requireSupabaseEnv(env: Env) {
  if (!env.SUPABASE_URL)
    throw new Error('SUPABASE_URL is required')
  if (!env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
}

export function hasSupabaseEnv(env: Env) {
  return !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY
}

export class SupabaseStorage implements StorageDriver {
  private readonly client: SupabaseClient
  private readonly bucket: string

  constructor(private readonly env: Env) {
    requireSupabaseEnv(env)
    this.bucket = env.SUPABASE_BUNDLE_BUCKET || 'codepushgo-bundles'
    this.client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async createApp(appId: string, name: string, ownerOrg?: string): Promise<AppRecord> {
    const existing = await this.getApp(appId)
    const { data, error } = await this.client
      .from('apps')
      .upsert({
        app_id: appId,
        name,
        owner_org: ownerOrg ?? existing?.ownerOrg ?? null,
        expose_metadata: existing?.exposeMetadata ?? false,
        transfer_history: existing?.transferHistory ?? [],
        created_at: existing?.createdAt ?? nowIso(),
      }, { onConflict: 'app_id' })
      .select('app_id,name,owner_org,expose_metadata,transfer_history,stats_updated_at,stats_refresh_requested_at,created_at')
      .single<AppRow>()

    if (error)
      throw error
    await this.upsertChannel({ appId, name: 'production', public: true, allowSelfSet: true })
    return toApp(data)
  }

  async updateApp(appId: string, input: { name?: string, exposeMetadata?: boolean }): Promise<AppRecord | undefined> {
    const existing = await this.getApp(appId)
    if (!existing)
      return undefined
    const { data, error } = await this.client
      .from('apps')
      .update({
        name: input.name ?? existing.name,
        expose_metadata: input.exposeMetadata ?? existing.exposeMetadata ?? false,
      })
      .eq('app_id', appId)
      .select('app_id,name,owner_org,expose_metadata,transfer_history,stats_updated_at,stats_refresh_requested_at,created_at')
      .single<AppRow>()
    if (error)
      throw error
    return toApp(data)
  }

  async getApp(appId: string): Promise<AppRecord | undefined> {
    const { data, error } = await this.client
      .from('apps')
      .select('app_id,name,owner_org,expose_metadata,transfer_history,stats_updated_at,stats_refresh_requested_at,created_at')
      .eq('app_id', appId)
      .maybeSingle<AppRow>()
    if (error)
      throw error
    return data ? toApp(data) : undefined
  }

  async listApps(): Promise<AppRecord[]> {
    const { data, error } = await this.client
      .from('apps')
      .select('app_id,name,owner_org,expose_metadata,transfer_history,stats_updated_at,stats_refresh_requested_at,created_at')
      .order('created_at', { ascending: false })

    if (error)
      throw error
    return (data ?? []).map((row) => toApp(row as AppRow))
  }

  async upsertOrganization(input: UpsertOrganizationInput): Promise<OrganizationRecord> {
    const { data, error } = await this.client
      .from('orgs')
      .upsert({
        id: input.id,
        name: input.name,
        management_email: input.managementEmail ?? null,
        enforce_encrypted_bundles: input.enforceEncryptedBundles ?? false,
        required_encryption_key: input.requiredEncryptionKey ?? null,
        created_by: input.createdBy ?? null,
        customer_id: input.customerId ?? null,
        website: input.website ?? null,
        password_policy_config: input.passwordPolicyConfig ?? null,
      }, { onConflict: 'id' })
      .select('id,name,management_email,created_by,customer_id,website,password_policy_config,enforce_encrypted_bundles,required_encryption_key,stats_updated_at,last_stats_updated_at,stats_refresh_requested_at,created_at')
      .single<OrganizationRow>()
    if (error)
      throw error
    return toOrganization(data)
  }

  async searchOrganizations(query: string, limit = 20): Promise<OrganizationRecord[]> {
    const trimmed = query.trim()
    if (!trimmed)
      return []
    const pattern = `%${trimmed.replace(/[,%]/g, '')}%`
    const { data, error } = await this.client
      .from('orgs')
      .select('id,name,management_email,created_by,customer_id,website,password_policy_config,enforce_encrypted_bundles,required_encryption_key,stats_updated_at,last_stats_updated_at,stats_refresh_requested_at,created_at')
      .or(`id.ilike.${pattern},name.ilike.${pattern},management_email.ilike.${pattern},customer_id.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit, 50)))
    if (error)
      throw error
    return (data ?? []).map(row => toOrganization(row as OrganizationRow))
  }

  async getOrganization(orgId: string): Promise<OrganizationRecord | undefined> {
    const { data, error } = await this.client
      .from('orgs')
      .select('id,name,management_email,created_by,customer_id,website,password_policy_config,enforce_encrypted_bundles,required_encryption_key,stats_updated_at,last_stats_updated_at,stats_refresh_requested_at,created_at')
      .eq('id', orgId)
      .maybeSingle<OrganizationRow>()
    if (error)
      throw error
    return data ? toOrganization(data) : undefined
  }

  async listOrganizations(): Promise<OrganizationRecord[]> {
    const { data, error } = await this.client
      .from('orgs')
      .select('id,name,management_email,created_by,customer_id,website,password_policy_config,enforce_encrypted_bundles,required_encryption_key,stats_updated_at,last_stats_updated_at,stats_refresh_requested_at,created_at')
      .order('created_at', { ascending: false })
    if (error)
      throw error
    return (data ?? []).map(row => toOrganization(row as OrganizationRow))
  }

  async deleteOrganization(orgId: string): Promise<boolean> {
    const { error } = await this.client.from('orgs').delete().eq('id', orgId)
    if (error)
      throw error
    return true
  }

  async listOrgMemberships(orgId: string): Promise<OrgMemberRecord[]> {
    const { data, error } = await this.client
      .from('org_users')
      .select('user_id,org_id,user_right,created_at,users(email)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
    if (error)
      throw error
    return (data ?? []).map((row: any) => ({
      userId: row.user_id,
      orgId: row.org_id,
      role: row.user_right,
      createdAt: row.created_at,
      email: row.users?.email ?? '',
    }))
  }

  async upsertOrgMembership(input: { orgId: string, userId: string, email: string, role: string }): Promise<OrgMemberRecord> {
    const now = new Date().toISOString()
    const { error: userError } = await this.client
      .from('users')
      .upsert({ id: input.userId, email: input.email, updated_at: now }, { onConflict: 'id' })
    if (userError)
      throw userError
    const { data, error } = await this.client
      .from('org_users')
      .upsert({ user_id: input.userId, org_id: input.orgId, user_right: input.role, created_at: now }, { onConflict: 'user_id,org_id' })
      .select('user_id,org_id,user_right,created_at')
      .single<OrgUserRow>()
    if (error)
      throw error
    return { ...toOrgMembership(data), email: input.email }
  }

  async deleteOrgMembershipByEmail(orgId: string, email: string): Promise<boolean> {
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle<{ id: string }>()
    if (userError)
      throw userError
    if (!user)
      return false
    const { error } = await this.client.from('org_users').delete().eq('org_id', orgId).eq('user_id', user.id)
    if (error)
      throw error
    return true
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
    const { data, error } = await this.client
      .from('role_bindings')
      .insert({
        principal_type: input.principalType,
        principal_id: input.principalId,
        role_name: input.roleName,
        scope_type: input.scopeType,
        org_id: input.orgId,
        app_id: input.appId ?? null,
        channel_id: normalizeChannelBindingId(input.channelId),
        reason: input.reason ?? null,
        is_direct: true,
        created_at: now,
        updated_at: now,
      })
      .select('id,principal_type,principal_id,role_name,scope_type,org_id,app_id,channel_id,reason,is_direct,created_at,updated_at')
      .single<RoleBindingStorageRow>()
    if (error)
      throw error
    const legacyRole = input.principalType === 'user' && input.scopeType === 'org' ? legacyRoleForRoleBinding(input.roleName) : null
    if (legacyRole) {
      const user = await this.getUser(input.principalId)
      await this.upsertOrgMembership({ orgId: input.orgId, userId: input.principalId, email: user?.email ?? '', role: legacyRole })
    }
    return toRoleBinding(data)
  }

  async getRoleBinding(id: string): Promise<RoleBindingRecord | undefined> {
    const { data, error } = await this.client
      .from('role_bindings')
      .select('id,principal_type,principal_id,role_name,scope_type,org_id,app_id,channel_id,reason,is_direct,created_at,updated_at')
      .eq('id', id)
      .maybeSingle<RoleBindingStorageRow>()
    if (error)
      throw error
    return data ? toRoleBinding(data) : undefined
  }

  async updateRoleBinding(id: string, input: UpdateRoleBindingInput): Promise<RoleBindingRecord | undefined> {
    const existing = await this.getRoleBinding(id)
    if (!existing)
      return undefined
    if (existing.roleName === 'org_super_admin' && input.roleName !== 'org_super_admin') {
      const { data: superAdmins, error: superAdminError } = await this.client
        .from('role_bindings')
        .select('id')
        .eq('org_id', existing.orgId)
        .eq('scope_type', 'org')
        .eq('role_name', 'org_super_admin')
      if (superAdminError)
        throw superAdminError
      if ((superAdmins ?? []).length <= 1)
        return undefined
    }
    const now = nowIso()
    const { data, error } = await this.client
      .from('role_bindings')
      .update({ role_name: input.roleName, updated_at: now })
      .eq('id', id)
      .select('id,principal_type,principal_id,role_name,scope_type,org_id,app_id,channel_id,reason,is_direct,created_at,updated_at')
      .maybeSingle<RoleBindingStorageRow>()
    if (error)
      throw error
    if (!data)
      return undefined
    const legacyRole = existing.principalType === 'user' && existing.scopeType === 'org' ? legacyRoleForRoleBinding(input.roleName) : null
    if (legacyRole) {
      const user = await this.getUser(existing.principalId)
      await this.upsertOrgMembership({ orgId: existing.orgId, userId: existing.principalId, email: user?.email ?? '', role: legacyRole })
    }
    return toRoleBinding(data)
  }

  async deleteRoleBinding(id: string): Promise<boolean> {
    const existing = await this.getRoleBinding(id)
    if (!existing)
      return false
    const { error } = await this.client.from('role_bindings').delete().eq('id', id)
    if (error)
      throw error
    if (existing.principalType === 'user' && existing.scopeType === 'org') {
      const { error: clearError } = await this.client
        .from('org_users')
        .update({ user_right: null, rbac_role_name: null })
        .eq('org_id', existing.orgId)
        .eq('user_id', existing.principalId)
      if (clearError)
        throw clearError
    }
    if (existing.principalType === 'user' && existing.scopeType === 'app') {
      const { error: overrideError } = await this.client
        .from('channel_permission_overrides')
        .delete()
        .eq('principal_type', existing.principalType)
        .eq('principal_id', existing.principalId)
      if (overrideError)
        throw overrideError
    }
    return true
  }

  async listRoleBindingsForAppScope(appId: string, scopeType?: RoleBindingScopeType): Promise<RoleBindingRecord[]> {
    let query = this.client
      .from('role_bindings')
      .select('id,principal_type,principal_id,role_name,scope_type,org_id,app_id,channel_id,reason,is_direct,created_at,updated_at')
      .eq('app_id', appId)
      .order('created_at', { ascending: true })
    if (scopeType)
      query = query.eq('scope_type', scopeType)
    const { data, error } = await query
    if (error)
      throw error
    return (data ?? []).map(row => toRoleBinding(row as RoleBindingStorageRow))
  }

  async upsertChannelPermissionOverride(input: ChannelPermissionOverrideRecord): Promise<ChannelPermissionOverrideRecord> {
    const { data, error } = await this.client
      .from('channel_permission_overrides')
      .upsert({
        principal_type: input.principalType,
        principal_id: input.principalId,
        channel_id: input.channelId,
        permission_key: input.permissionKey,
        is_allowed: input.isAllowed,
      }, { onConflict: 'principal_type,principal_id,channel_id,permission_key' })
      .select('principal_type,principal_id,channel_id,permission_key,is_allowed')
      .single<ChannelPermissionOverrideStorageRow>()
    if (error)
      throw error
    return toChannelPermissionOverride(data)
  }

  async listChannelPermissionOverrides(principalType: RoleBindingPrincipalType, principalId: string): Promise<ChannelPermissionOverrideRecord[]> {
    const { data, error } = await this.client
      .from('channel_permission_overrides')
      .select('principal_type,principal_id,channel_id,permission_key,is_allowed')
      .eq('principal_type', principalType)
      .eq('principal_id', principalId)
    if (error)
      throw error
    return (data ?? []).map(row => toChannelPermissionOverride(row as ChannelPermissionOverrideStorageRow))
  }

  async getUsageCreditBalance(orgId: string): Promise<UsageCreditBalanceRecord | undefined> {
    const { data: org, error: orgError } = await this.client.from('orgs').select('id').eq('id', orgId).maybeSingle<{ id: string }>()
    if (orgError)
      throw orgError
    if (!org)
      return undefined
    const { data: grants, error: grantsError } = await this.client.from('usage_credit_grants').select('amount').eq('org_id', orgId)
    if (grantsError)
      throw grantsError
    const { data: used, error: usedError } = await this.client.from('usage_credit_transactions').select('amount').eq('org_id', orgId)
    if (usedError)
      throw usedError
    return creditBalance(
      orgId,
      (grants ?? []).reduce((sum, row) => sum + Number((row as UsageCreditTransactionRow).amount), 0),
      (used ?? []).reduce((sum, row) => sum + Number((row as UsageCreditTransactionRow).amount), 0),
    )
  }

  async grantUsageCredits(input: GrantUsageCreditsInput): Promise<{ org: OrganizationRecord, grant: UsageCreditGrantRecord, balance: UsageCreditBalanceRecord } | undefined> {
    const { data: orgRow, error: orgError } = await this.client
      .from('orgs')
      .select('id,name,management_email,created_by,customer_id,website,password_policy_config,enforce_encrypted_bundles,required_encryption_key,created_at')
      .eq('id', input.orgId)
      .maybeSingle<OrganizationRow>()
    if (orgError)
      throw orgError
    if (!orgRow)
      return undefined
    const { data: grantRow, error: grantError } = await this.client
      .from('usage_credit_grants')
      .insert({ org_id: input.orgId, amount: input.amount, notes: input.notes ?? null, created_by: input.createdBy ?? null })
      .select('id,org_id,amount,notes,created_by,created_at')
      .single<UsageCreditGrantRow>()
    if (grantError)
      throw grantError
    const balance = await this.getUsageCreditBalance(input.orgId)
    return { org: toOrganization(orgRow), grant: toUsageCreditGrant(grantRow), balance: balance ?? creditBalance(input.orgId, input.amount, 0) }
  }
  async consumeUsageCredits(input: ConsumeUsageCreditsInput): Promise<{ balance: UsageCreditBalanceRecord, overageEvent?: UsageOverageEventRecord } | undefined> {
    const existing = await this.getUsageCreditBalance(input.orgId)
    if (!existing)
      return undefined
    const existingOverageEvent = findMatchingUsageOverageEvent(await this.listUsageOverageEvents(input.orgId), input)
    if (input.metric && input.overageAmount !== undefined && !shouldCreateUsageOverageEvent(existingOverageEvent, input))
      return { balance: existing, overageEvent: existingOverageEvent }

    const amount = Math.max(0, Math.ceil(input.amount))
    const { error: transactionError } = await this.client
      .from('usage_credit_transactions')
      .insert({ org_id: input.orgId, amount, reason: input.reason ?? null })
    if (transactionError)
      throw transactionError

    let overageEvent: UsageOverageEventRecord | undefined
    if (input.metric && input.overageAmount !== undefined) {
      const { data, error } = await this.client
        .from('usage_overage_events')
        .insert({ org_id: input.orgId, metric: input.metric, overage_amount: input.overageAmount, credits_consumed: amount, details: input.details ?? {} })
        .select('id,org_id,metric,overage_amount,credits_consumed,details,created_at')
        .single<UsageOverageEventRow>()
      if (error)
        throw error
      overageEvent = toUsageOverageEvent(data)
    }

    const balance = await this.getUsageCreditBalance(input.orgId)
    return { balance: balance ?? creditBalance(input.orgId, existing.totalCredits, existing.usedCredits + amount), overageEvent }
  }

  async listUsageCreditGrants(limit = 50): Promise<UsageCreditGrantRecord[]> {
    const { data, error } = await this.client
      .from('usage_credit_grants')
      .select('id,org_id,amount,notes,created_by,created_at')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit, 100)))
    if (error)
      throw error
    return (data ?? []).map(row => toUsageCreditGrant(row as UsageCreditGrantRow))
  }

  async listUsageOverageEvents(orgId: string): Promise<UsageOverageEventRecord[]> {
    const { data, error } = await this.client
      .from('usage_overage_events')
      .select('id,org_id,metric,overage_amount,credits_consumed,details,created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (error)
      throw error
    return (data ?? []).map(row => toUsageOverageEvent(row as UsageOverageEventRow))
  }

  async upsertStripeInfo(input: UpsertStripeInfoInput): Promise<StripeInfoRecord> {
    const existing = await this.getStripeInfoByCustomerId(input.customerId)
    const { data, error } = await this.client
      .from('stripe_info')
      .upsert({
        customer_id: input.customerId,
        status: input.status ?? existing?.status ?? null,
        is_good_plan: input.isGoodPlan ?? existing?.isGoodPlan ?? null,
        plan_calculated_at: input.planCalculatedAt ?? existing?.planCalculatedAt ?? null,
      }, { onConflict: 'customer_id' })
      .select('customer_id,status,is_good_plan,plan_calculated_at')
      .single<StripeInfoRow>()
    if (error)
      throw error
    return toStripeInfo(data)
  }

  async getStripeInfoByCustomerId(customerId: string): Promise<StripeInfoRecord | undefined> {
    const { data, error } = await this.client
      .from('stripe_info')
      .select('customer_id,status,is_good_plan,plan_calculated_at')
      .eq('customer_id', customerId)
      .maybeSingle<StripeInfoRow>()
    if (error)
      throw error
    return data ? toStripeInfo(data) : undefined
  }

  async markAppStatsRefreshed(appId: string, refreshedAt = nowIso()): Promise<AppRecord | undefined> {
    const { data, error } = await this.client
      .from('apps')
      .update({ stats_updated_at: refreshedAt })
      .eq('app_id', appId)
      .select('app_id,name,owner_org,expose_metadata,transfer_history,stats_updated_at,stats_refresh_requested_at,created_at')
      .maybeSingle<AppRow>()
    if (error)
      throw error
    return data ? toApp(data) : undefined
  }

  async markOrgStatsRefreshed(orgId: string, refreshedAt = nowIso()): Promise<OrganizationRecord | undefined> {
    const existing = await this.getOrganization(orgId)
    if (!existing)
      return undefined
    const { data, error } = await this.client
      .from('orgs')
      .update({ last_stats_updated_at: existing.statsUpdatedAt ?? existing.lastStatsUpdatedAt ?? null, stats_updated_at: refreshedAt })
      .eq('id', orgId)
      .select('id,name,management_email,created_by,customer_id,website,password_policy_config,enforce_encrypted_bundles,required_encryption_key,stats_updated_at,last_stats_updated_at,stats_refresh_requested_at,created_at')
      .maybeSingle<OrganizationRow>()
    if (error)
      throw error
    return data ? toOrganization(data) : undefined
  }

  async markStripePlanCalculated(customerId: string, calculatedAt = nowIso()): Promise<StripeInfoRecord | undefined> {
    const { data, error } = await this.client
      .from('stripe_info')
      .update({ plan_calculated_at: calculatedAt, updated_at: calculatedAt })
      .eq('customer_id', customerId)
      .select('customer_id,status,is_good_plan,plan_calculated_at')
      .maybeSingle<StripeInfoRow>()
    if (error)
      throw error
    return data ? toStripeInfo(data) : undefined
  }

  async transferApp(appId: string, newOwnerOrg: string): Promise<AppRecord | undefined> {
    const existing = await this.getApp(appId)
    if (!existing)
      return undefined
    const transferredAt = nowIso()
    const history = [...(existing.transferHistory ?? []), { fromOrg: existing.ownerOrg ?? null, toOrg: newOwnerOrg, transferredAt }]
    const appUpdate = await this.client
      .from('apps')
      .update({ owner_org: newOwnerOrg, transfer_history: history })
      .eq('app_id', appId)
    if (appUpdate.error)
      throw appUpdate.error
    const releaseUpdate = await this.client
      .from('releases')
      .update({ owner_org: newOwnerOrg })
      .eq('app_id', appId)
    if (releaseUpdate.error)
      throw releaseUpdate.error
    return this.getApp(appId)
  }

  async deleteApp(appId: string): Promise<boolean> {
    const existing = await this.getApp(appId)
    if (!existing)
      return false
    const { error } = await this.client.from('apps').delete().eq('app_id', appId)
    if (error)
      throw error
    return true
  }

  async upsertSsoProvider(provider: Pick<SsoProviderRecord, 'providerId' | 'orgId'> & Partial<SsoProviderRecord>): Promise<SsoProviderRecord> {
    const existing = this.ssoProvidersSelect(provider.providerId)
    const existingRow = await existing
    const { data, error } = await this.client
      .from('sso_providers')
      .upsert({
        provider_id: provider.providerId,
        org_id: provider.orgId,
        domain: provider.domain ?? existingRow?.domain ?? null,
        enabled: provider.enabled ?? existingRow?.enabled ?? true,
        enforce_sso: provider.enforceSso ?? existingRow?.enforce_sso ?? false,
        created_at: existingRow?.created_at ?? provider.createdAt ?? nowIso(),
      }, { onConflict: 'provider_id' })
      .select('provider_id,org_id,domain,enabled,enforce_sso,created_at')
      .single<SsoProviderRow>()
    if (error)
      throw error
    return toSsoProvider(data)
  }

  async getSsoProvider(providerId: string): Promise<SsoProviderRecord | undefined> {
    const provider = await this.ssoProvidersSelect(providerId)
    return provider ? toSsoProvider(provider) : undefined
  }

  async provisionSsoUser(input: SsoProvisionInput): Promise<SsoProvisionResult | undefined> {
    const provider = await this.ssoProvidersSelect(input.providerId)
    if ((!provider || !provider.enabled) && !input.orgId)
      return undefined
    const orgId = input.orgId ?? provider!.org_id
    if (input.orgId && !provider)
      await this.upsertSsoProvider({ providerId: input.providerId, orgId })

    const existingMembership = await this.getOrgMembership(input.userId, orgId)
    const now = nowIso()
    const userResult = await this.client
      .from('users')
      .upsert({
        id: input.userId,
        email: input.email,
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        updated_at: now,
      }, { onConflict: 'id' })
    if (userResult.error)
      throw userResult.error

    if (!existingMembership) {
      const membershipResult = await this.client
        .from('org_users')
        .insert({ user_id: input.userId, org_id: orgId, user_right: 'read', created_at: now })
      if (membershipResult.error && membershipResult.error.code !== '23505')
        throw membershipResult.error
    }
    return { success: true, merged: false, alreadyMember: !!existingMembership, orgId, userId: input.userId }
  }

  async getUser(userId: string): Promise<UserRecord | undefined> {
    const { data, error } = await this.client
      .from('users')
      .select('id,email,first_name,last_name,created_at,updated_at')
      .eq('id', userId)
      .maybeSingle<UserRow>()
    if (error)
      throw error
    return data ? toUser(data) : undefined
  }

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const { data, error } = await this.client
      .from('users')
      .select('id,email,first_name,last_name,created_at,updated_at')
      .ilike('email', email)
      .maybeSingle<UserRow>()
    if (error)
      throw error
    return data ? toUser(data) : undefined
  }

  async getOrgMembership(userId: string, orgId: string): Promise<OrgMembershipRecord | undefined> {
    const { data, error } = await this.client
      .from('org_users')
      .select('user_id,org_id,user_right,created_at')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle<OrgUserRow>()
    if (error)
      throw error
    return data ? toOrgMembership(data) : undefined
  }

  async createPendingInvitation(input: CreatePendingInvitationInput): Promise<PendingInvitationRecord> {
    const existing = await this.getPendingInvitation(input.inviteMagicString)
    const { data, error } = await this.client
      .from('tmp_users')
      .upsert({
        invite_magic_string: input.inviteMagicString,
        email: input.email,
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        future_uuid: input.futureUuid,
        org_id: input.orgId,
        role: input.role,
        cancelled_at: input.cancelledAt ?? null,
        created_at: existing?.createdAt ?? nowIso(),
      }, { onConflict: 'invite_magic_string' })
      .select('invite_magic_string,email,first_name,last_name,future_uuid,org_id,role,cancelled_at,created_at')
      .single<PendingInvitationRow>()
    if (error)
      throw error
    return toPendingInvitation(data)
  }

  async getPendingInvitation(inviteMagicString: string): Promise<PendingInvitationRecord | undefined> {
    const { data, error } = await this.client
      .from('tmp_users')
      .select('invite_magic_string,email,first_name,last_name,future_uuid,org_id,role,cancelled_at,created_at')
      .eq('invite_magic_string', inviteMagicString)
      .maybeSingle<PendingInvitationRow>()
    if (error)
      throw error
    return data ? toPendingInvitation(data) : undefined
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult | undefined> {
    const invitation = await this.getPendingInvitation(input.magicInviteString)
    if (!invitation || invitation.cancelledAt)
      return undefined
    const now = nowIso()
    const userResult = await this.client
      .from('users')
      .upsert({
        id: invitation.futureUuid,
        email: invitation.email,
        first_name: invitation.firstName ?? null,
        last_name: invitation.lastName ?? null,
        opt_for_newsletters: input.optForNewsletters,
        updated_at: now,
      }, { onConflict: 'id' })
    if (userResult.error)
      throw userResult.error
    const role = legacyInviteRole(invitation.role)
    const membership = await this.client
      .from('org_users')
      .upsert({ user_id: invitation.futureUuid, org_id: invitation.orgId, user_right: role, created_at: now }, { onConflict: 'user_id,org_id' })
    if (membership.error)
      throw membership.error
    const remove = await this.client.from('tmp_users').delete().eq('invite_magic_string', input.magicInviteString)
    if (remove.error)
      throw remove.error
    return { success: true, userId: invitation.futureUuid, orgId: invitation.orgId, role }
  }

  private async ssoProvidersSelect(providerId: string): Promise<SsoProviderRow | null> {
    const { data, error } = await this.client
      .from('sso_providers')
      .select('provider_id,org_id,domain,enabled,enforce_sso,created_at')
      .eq('provider_id', providerId)
      .maybeSingle<SsoProviderRow>()
    if (error)
      throw error
    return data
  }
  async listApiKeys(): Promise<ApiKeyRecord[]> {
    const { data, error } = await this.client
      .from('apikeys')
      .select('id,name,key_hash,rbac_id,expires_at,created_at,updated_at')
      .order('created_at', { ascending: false })
    if (error)
      throw error
    const records: ApiKeyRecord[] = []
    for (const row of data ?? []) {
      const record = await this.getApiKey((row as ApiKeyRow).id)
      if (record)
        records.push(record)
    }
    return records
  }

  async getApiKey(id: number): Promise<ApiKeyRecord | undefined> {
    const { data, error } = await this.client
      .from('apikeys')
      .select('id,name,key_hash,rbac_id,expires_at,created_at,updated_at')
      .eq('id', id)
      .maybeSingle<ApiKeyRow>()
    if (error)
      throw error
    if (!data)
      return undefined
    return toApiKey(data, await this.getApiKeyBindings(id), await this.getApiKeyGlobalPermissions(id))
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | undefined> {
    const { data, error } = await this.client
      .from('apikeys')
      .select('id,name,key_hash,rbac_id,expires_at,created_at,updated_at')
      .eq('key_hash', keyHash)
      .maybeSingle<ApiKeyRow>()
    if (error)
      throw error
    return data ? this.getApiKey(data.id) : undefined
  }

  async createApiKey(input: CreateApiKeyInput): Promise<ApiKeyRecord> {
    const createdAt = nowIso()
    const { data, error } = await this.client
      .from('apikeys')
      .insert({
        name: input.name,
        key_hash: input.keyHash,
        rbac_id: crypto.randomUUID(),
        expires_at: input.expiresAt ?? null,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select('id,name,key_hash,rbac_id,expires_at,created_at,updated_at')
      .single<ApiKeyRow>()
    if (error)
      throw error
    await this.replaceApiKeyBindings(data.id, input.bindings)
    await this.replaceApiKeyGlobalPermissions(data.id, input.globalPermissions ?? [])
    const record = await this.getApiKey(data.id)
    if (!record)
      throw new Error('API key was not created')
    return record
  }

  async updateApiKey(id: number, input: UpdateApiKeyInput): Promise<ApiKeyRecord | undefined> {
    const existing = await this.getApiKey(id)
    if (!existing)
      return undefined
    const { error } = await this.client
      .from('apikeys')
      .update({
        name: input.name ?? existing.name,
        key_hash: input.keyHash ?? existing.keyHash,
        expires_at: Object.prototype.hasOwnProperty.call(input, 'expiresAt') ? input.expiresAt ?? null : existing.expiresAt,
        updated_at: nowIso(),
      })
      .eq('id', id)
    if (error)
      throw error
    if (input.bindings)
      await this.replaceApiKeyBindings(id, input.bindings)
    if (input.globalPermissions)
      await this.replaceApiKeyGlobalPermissions(id, input.globalPermissions)
    return this.getApiKey(id)
  }

  async deleteApiKey(id: number): Promise<boolean> {
    const existing = await this.getApiKey(id)
    if (!existing)
      return false
    await this.client.from('apikey_global_permissions').delete().eq('apikey_id', id)
    await this.client.from('apikey_bindings').delete().eq('apikey_id', id)
    const { error } = await this.client.from('apikeys').delete().eq('id', id)
    if (error)
      throw error
    return true
  }

  private async getApiKeyBindings(id: number): Promise<ApiKeyBindingRecord[]> {
    const { data, error } = await this.client
      .from('apikey_bindings')
      .select('apikey_id,role_name,scope_type,org_id,app_id,reason')
      .eq('apikey_id', id)
      .order('id', { ascending: true })
    if (error)
      throw error
    return (data ?? []).map((row) => toApiKeyBinding(row as ApiKeyBindingRow))
  }

  private async getApiKeyGlobalPermissions(id: number): Promise<string[]> {
    const { data, error } = await this.client
      .from('apikey_global_permissions')
      .select('apikey_id,permission_key')
      .eq('apikey_id', id)
      .order('permission_key', { ascending: true })
    if (error)
      throw error
    return (data ?? []).map((row) => (row as ApiKeyGlobalPermissionRow).permission_key)
  }

  private async replaceApiKeyBindings(id: number, bindings: ApiKeyBindingRecord[]): Promise<void> {
    const remove = await this.client.from('apikey_bindings').delete().eq('apikey_id', id)
    if (remove.error)
      throw remove.error
    if (bindings.length === 0)
      return
    const { error } = await this.client.from('apikey_bindings').insert(bindings.map((binding) => apiKeyBindingRow(id, binding)))
    if (error)
      throw error
  }

  private async replaceApiKeyGlobalPermissions(id: number, permissions: string[]): Promise<void> {
    const remove = await this.client.from('apikey_global_permissions').delete().eq('apikey_id', id)
    if (remove.error)
      throw remove.error
    if (permissions.length === 0)
      return
    const { error } = await this.client.from('apikey_global_permissions').insert(permissions.map((permission) => ({ apikey_id: id, permission_key: permission })))
    if (error)
      throw error
  }
  async recordAuditLog(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const { data, error } = await this.client
      .from('audit_logs')
      .insert({
        table_name: input.tableName,
        record_id: input.recordId,
        operation: input.operation,
        user_id: input.userId ?? null,
        org_id: input.orgId,
        old_record: input.oldRecord ?? null,
        new_record: input.newRecord ?? null,
        changed_fields: input.changedFields ?? null,
      })
      .select('id,created_at,table_name,record_id,operation,user_id,org_id,old_record,new_record,changed_fields')
      .single<AuditLogRow>()
    if (error)
      throw error
    return toAuditLog(data)
  }

  async listAuditLogs(query: ListAuditLogsQuery): Promise<ListAuditLogsResult> {
    let countQuery = this.client
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', query.orgId)
    let dataQuery = this.client
      .from('audit_logs')
      .select('id,created_at,table_name,record_id,operation,user_id,org_id,old_record,new_record,changed_fields')
      .eq('org_id', query.orgId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(query.page * query.limit, query.page * query.limit + query.limit - 1)

    if (query.tableName) {
      countQuery = countQuery.eq('table_name', query.tableName)
      dataQuery = dataQuery.eq('table_name', query.tableName)
    }
    if (query.operation) {
      countQuery = countQuery.eq('operation', query.operation)
      dataQuery = dataQuery.eq('operation', query.operation)
    }

    const countResult = await countQuery
    if (countResult.error)
      throw countResult.error
    const { data, error } = await dataQuery
    if (error)
      throw error
    return {
      data: (data ?? []).map((row) => toAuditLog(row as AuditLogRow)),
      total: countResult.count ?? 0,
      page: query.page,
      limit: query.limit,
    }
  }

  async createCompatibilityEvent(input: CreateCompatibilityEventInput): Promise<StoredCompatibilityEvent> {
    const { data, error } = await this.client
      .from('compatibility_events')
      .upsert({
        org_id: input.org_id,
        app_id: input.app_id,
        source: input.source,
        platform: input.platform,
        channel_id: input.channel_id,
        channel_name: input.channel_name,
        current_version_id: input.current_version_id,
        current_version_name: input.current_version_name,
        previous_version_id: input.previous_version_id,
        previous_version_name: input.previous_version_name,
        offenders: input.offenders,
        change_occurred_at: input.change_occurred_at,
      }, { onConflict: 'app_id,channel_id,platform,current_version_id,previous_version_id,change_occurred_at' })
      .select('*')
      .single<CompatibilityEventRow>()
    if (error)
      throw error
    return toCompatibilityEvent(data)
  }

  async getCompatibilityEvent(id: number): Promise<StoredCompatibilityEvent | undefined> {
    const { data, error } = await this.client
      .from('compatibility_events')
      .select('*')
      .eq('id', id)
      .maybeSingle<CompatibilityEventRow>()
    if (error)
      throw error
    return data ? toCompatibilityEvent(data) : undefined
  }

  async listCompatibilityEvents(appId: string): Promise<StoredCompatibilityEvent[]> {
    const { data, error } = await this.client
      .from('compatibility_events')
      .select('*')
      .eq('app_id', appId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (error)
      throw error
    return (data ?? []).map(row => toCompatibilityEvent(row as CompatibilityEventRow))
  }

  async acknowledgeCompatibilityEvent(input: AcknowledgeCompatibilityEventInput): Promise<StoredCompatibilityEvent | undefined> {
    const existing = await this.getCompatibilityEvent(input.id)
    if (!existing || existing.resolved_at)
      return existing
    const { data, error } = await this.client
      .from('compatibility_events')
      .update({
        resolved_at: nowIso(),
        resolved_by: input.resolvedBy ?? null,
        resolution_kind: 'accepted',
        resolution_note: input.note,
      })
      .eq('id', input.id)
      .is('resolved_at', null)
      .select('*')
      .maybeSingle<CompatibilityEventRow>()
    if (error)
      throw error
    return data ? toCompatibilityEvent(data) : undefined
  }



  async createRelease(input: CreateReleaseInput): Promise<ReleaseRecord> {
    let app = await this.getApp(input.appId)
    if (!app)
      app = await this.createApp(input.appId, input.appId)
    await this.upsertChannel({ appId: input.appId, name: input.channel, public: input.channel === 'production', allowSelfSet: true })

    const path = `apps/${input.appId}/${input.platform}/${input.channel}/${input.version}/bundle.zip`
    const upload = await this.client.storage.from(this.bucket).upload(path, input.bytes, {
      contentType: 'application/zip',
      upsert: true,
    })

    if (upload.error)
      throw upload.error

    const { data, error } = await this.client
      .from('releases')
      .upsert({
        app_id: input.appId,
        version: input.version,
        session_key: input.sessionKey ?? null,
        key_id: input.keyId ?? null,
        platform: input.platform,
        channel: input.channel,
        path,
        checksum: input.checksum,
        size: input.size,
        mandatory: input.mandatory,
        min_update_version: input.minUpdateVersion ?? null,
        native_packages: input.nativePackages ?? [],
        rollout: input.rollout,
        notes: input.notes ?? null,
        owner_org: app.ownerOrg ?? null,
        created_at: nowIso(),
      }, { onConflict: 'app_id,platform,channel,version' })
      .select('app_id,version,platform,channel,path,checksum,session_key,key_id,size,mandatory,rollout,notes,min_update_version,native_packages,owner_org,created_at')
      .single<ReleaseRow>()

    if (error)
      throw error
    return toRelease(data)
  }

  async listReleases(appId: string): Promise<ReleaseRecord[]> {
    const { data, error } = await this.client
      .from('releases')
      .select('app_id,version,platform,channel,path,checksum,session_key,key_id,size,mandatory,rollout,notes,min_update_version,native_packages,owner_org,created_at')
      .eq('app_id', appId)
      .order('created_at', { ascending: false })

    if (error)
      throw error
    return sortReleasesNewestFirst((data ?? []).map((row) => toRelease(row as ReleaseRow)))
  }
  async upsertVersionMeta(input: UpsertVersionMetaInput): Promise<boolean> {
    if (input.size === 0)
      return false
    const releases = await this.listReleases(input.appId)
    if (!releases[input.versionId - 1])
      return false

    const { data, error } = await this.client.rpc('upsert_version_meta' as never, {
      p_app_id: input.appId,
      p_version_id: input.versionId,
      p_size: input.size,
    } as never)
    if (error)
      return false
    return data === true
  }

  async deleteReleases(appId: string, version?: string): Promise<boolean> {
    const releases = await this.listReleases(appId)
    const matches = version ? releases.filter((release) => release.version === version) : releases
    if (matches.length === 0)
      return false
    for (const release of matches)
      await this.client.storage.from(this.bucket).remove([release.path])

    let query = this.client.from('releases').delete().eq('app_id', appId)
    if (version)
      query = query.eq('version', version)
    const { error } = await query
    if (error)
      throw error
    return true
  }

  async listChannels(appId: string, platform?: Platform): Promise<ChannelRecord[]> {
    const channels = await this.client
      .from('channels')
      .select('app_id,name,public,allow_self_set,ios,android,electron')
      .eq('app_id', appId)
    if (channels.error)
      throw channels.error
    const releases = await this.listReleases(appId)
    return mergeChannels((channels.data ?? []).map((row) => toChannel(row as ChannelRow)), platform ? releases.filter((release) => release.platform === platform) : releases)
  }

  async upsertChannel(input: UpsertChannelInput): Promise<ChannelRecord> {
    const bothMobile = input.ios === true && input.android === true
    const row: ChannelRow = {
      app_id: input.appId,
      name: input.name,
      public: input.public ?? input.name === 'production',
      allow_self_set: input.allowSelfSet ?? true,
      ios: input.ios ?? null,
      android: input.android ?? null,
      electron: input.electron ?? (bothMobile ? null : false),
    }
    if (row.public) {
      const { data: publicChannels, error: publicChannelsError } = await this.client
        .from('channels')
        .select('app_id,name,public,allow_self_set,ios,android,electron')
        .eq('app_id', row.app_id)
        .eq('public', true)
        .neq('name', row.name)
      if (publicChannelsError)
        throw publicChannelsError
      for (const channel of publicChannels ?? []) {
        if (publicChannelsOverlap(row, channel as ChannelRow)) {
          const { error: demoteError } = await this.client
            .from('channels')
            .update({ public: false, updated_at: nowIso() })
            .eq('app_id', row.app_id)
            .eq('name', (channel as ChannelRow).name)
          if (demoteError)
            throw demoteError
        }
      }
    }
    const { data, error } = await this.client
      .from('channels')
      .upsert({ ...row, updated_at: nowIso() }, { onConflict: 'app_id,name' })
      .select('app_id,name,public,allow_self_set,ios,android,electron')
      .single<ChannelRow>()
    if (error)
      throw error
    return toChannel(data)
  }
  async deleteChannel(appId: string, channel: string): Promise<boolean> {
    const channels = await this.listChannels(appId)
    if (!channels.some((record) => record.name === channel))
      return false
    await this.client.from('channels').delete().eq('app_id', appId).eq('name', channel)
    await this.client.from('releases').delete().eq('app_id', appId).eq('channel', channel)
    await this.client.from('device_channels').delete().eq('app_id', appId).eq('channel', channel)
    return true
  }

  async getRelease(appId: string, platform: Platform, channel: string, version: string): Promise<ReleaseRecord | undefined> {
    const { data, error } = await this.client
      .from('releases')
      .select('app_id,version,platform,channel,path,checksum,session_key,key_id,size,mandatory,rollout,notes,min_update_version,native_packages,owner_org,created_at')
      .eq('app_id', appId)
      .eq('platform', platform)
      .eq('channel', channel)
      .eq('version', version)
      .maybeSingle<ReleaseRow>()

    if (error)
      throw error
    return data ? toRelease(data) : undefined
  }

  async findLatestRelease(appId: string, platform: Platform, channel: string): Promise<ReleaseRecord | undefined> {
    const { data, error } = await this.client
      .from('releases')
      .select('app_id,version,platform,channel,path,checksum,session_key,key_id,size,mandatory,rollout,notes,min_update_version,native_packages,owner_org,created_at')
      .eq('app_id', appId)
      .eq('platform', platform)
      .eq('channel', channel)
    if (error)
      throw error
    return sortReleasesNewestFirst((data ?? []).map((row) => toRelease(row as ReleaseRow)))[0]
  }

  async getBundle(release: ReleaseRecord): Promise<BundleObject | undefined> {
    const { data, error } = await this.client.storage.from(this.bucket).download(release.path)
    if (error)
      throw error
    if (!data)
      return undefined

    return {
      body: new Response(data).body,
      contentType: data.type || 'application/zip',
      size: data.size,
      checksum: release.checksum,
    }
  }

  async listDevices(appId: string): Promise<DeviceRecord[]> {
    const { data, error } = await this.client
      .from('devices')
      .select('app_id,device_id,platform,plugin_version,os_version,version_build,version_name,custom_id,key_id,is_prod,is_emulator,default_channel,updated_at')
      .eq('app_id', appId)
      .order('updated_at', { ascending: false })
    if (error)
      throw error
    const devices: DeviceRecord[] = []
    for (const row of data ?? [])
      devices.push(toDevice(row as DeviceRow, await this.getDeviceChannel((row as DeviceRow).app_id, (row as DeviceRow).device_id)))
    return devices
  }

  async getDevice(appId: string, deviceId: string): Promise<DeviceRecord | undefined> {
    const { data, error } = await this.client
      .from('devices')
      .select('app_id,device_id,platform,plugin_version,os_version,version_build,version_name,custom_id,key_id,is_prod,is_emulator,default_channel,updated_at')
      .eq('app_id', appId)
      .eq('device_id', deviceId)
      .maybeSingle<DeviceRow>()
    if (error)
      throw error
    return data ? toDevice(data, await this.getDeviceChannel(appId, deviceId)) : undefined
  }

  async upsertDevice(input: UpsertDeviceInput): Promise<DeviceRecord> {
    const { error } = await this.client.from('devices').upsert({
      app_id: input.appId,
      device_id: input.deviceId,
      platform: input.platform ?? null,
      plugin_version: input.pluginVersion ?? null,
      os_version: input.osVersion ?? null,
      version_build: input.versionBuild ?? null,
      key_id: input.keyId ?? null,
      version_name: input.versionName ?? null,
      custom_id: input.customId ?? null,
      is_prod: input.isProd ?? null,
      is_emulator: input.isEmulator ?? null,
      default_channel: input.defaultChannel ?? null,
      updated_at: nowIso(),
    }, { onConflict: 'app_id,device_id' })
    if (error)
      throw error
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
    const { error } = await this.client.from('devices').delete().eq('app_id', appId).eq('device_id', deviceId)
    if (error)
      throw error
    return !!existing
  }

  async getDeviceChannel(appId: string, deviceId: string): Promise<string | undefined> {
    const { data, error } = await this.client
      .from('device_channels')
      .select('channel')
      .eq('app_id', appId)
      .eq('device_id', deviceId)
      .maybeSingle<{ channel: string }>()

    if (error)
      throw error
    return data?.channel
  }

  async setDeviceChannel(appId: string, deviceId: string, channel: string): Promise<void> {
    const { error } = await this.client.from('device_channels').upsert({
      app_id: appId,
      device_id: deviceId,
      channel,
      updated_at: nowIso(),
    }, { onConflict: 'app_id,device_id' })

    if (error)
      throw error
  }

  async clearDeviceChannel(appId: string, deviceId: string): Promise<void> {
    const { error } = await this.client
      .from('device_channels')
      .delete()
      .eq('app_id', appId)
      .eq('device_id', deviceId)

    if (error)
      throw error
  }

  async createBuildRequest(input: CreateBuildRequestInput): Promise<BuildRequestRecord> {
    const now = nowIso()
    const { data, error } = await this.client
      .from('build_requests')
      .insert({
        id: input.id ?? crypto.randomUUID(),
        app_id: input.appId,
        owner_org: input.ownerOrg,
        requested_by: input.requestedBy,
        platform: input.platform,
        build_mode: input.buildMode,
        status: input.status ?? 'pending',
        builder_job_id: input.builderJobId,
        created_at: now,
        updated_at: now,
      })
      .select('id, app_id, owner_org, requested_by, platform, build_mode, status, builder_job_id, created_at, updated_at')
      .single<BuildRequestRow>()

    if (error)
      throw error
    return toBuildRequest(data)
  }

  async getBuildRequestByJobId(jobId: string): Promise<BuildRequestRecord | undefined> {
    const { data, error } = await this.client
      .from('build_requests')
      .select('id, app_id, owner_org, requested_by, platform, build_mode, status, builder_job_id, created_at, updated_at')
      .eq('builder_job_id', jobId)
      .maybeSingle<BuildRequestRow>()

    if (error)
      throw error
    return data ? toBuildRequest(data) : undefined
  }

  async updateBuildRequestStatus(jobId: string, status: string): Promise<BuildRequestRecord | undefined> {
    const { data, error } = await this.client
      .from('build_requests')
      .update({ status, updated_at: nowIso() })
      .eq('builder_job_id', jobId)
      .select('id, app_id, owner_org, requested_by, platform, build_mode, status, builder_job_id, created_at, updated_at')
      .maybeSingle<BuildRequestRow>()

    if (error)
      throw error
    return data ? toBuildRequest(data) : undefined
  }

  async recordBuildTime(input: RecordBuildTimeInput): Promise<BuildLogRecord> {
    const billableSeconds = billableBuildSeconds(input.platform, input.buildTimeUnit)
    const now = nowIso()
    const { data: existing, error: existingError } = await this.client
      .from('build_logs')
      .select('created_at')
      .eq('build_id', input.buildId)
      .maybeSingle<{ created_at: string }>()
    if (existingError)
      throw existingError

    const { data, error } = await this.client
      .from('build_logs')
      .upsert({
        build_id: input.buildId,
        org_id: input.orgId,
        user_id: input.userId,
        app_id: input.appId,
        platform: input.platform,
        build_time_unit: input.buildTimeUnit,
        billable_seconds: billableSeconds,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      }, { onConflict: 'build_id' })
      .select('build_id, org_id, user_id, app_id, platform, build_time_unit, billable_seconds, created_at, updated_at')
      .single<BuildLogRow>()
    if (error)
      throw error

    const dates = new Set([buildTimeDateId(existing ? new Date(existing.created_at) : new Date()), buildTimeDateId(new Date(now))])
    for (const date of dates)
      await this.recomputeDailyBuildTime(input.appId, date)
    return toBuildLog(data)
  }

  private async recomputeDailyBuildTime(appId: string, date: string): Promise<void> {
    const start = `${date}T00:00:00.000Z`
    const end = `${date}T23:59:59.999Z`
    const { data, error } = await this.client
      .from('build_logs')
      .select('billable_seconds')
      .eq('app_id', appId)
      .gte('created_at', start)
      .lte('created_at', end)
    if (error)
      throw error
    const logs = (data ?? []) as Array<{ billable_seconds: number }>
    const buildTimeUnit = logs.reduce((sum, log) => sum + Number(log.billable_seconds), 0)
    const { error: upsertError } = await this.client
      .from('daily_build_time')
      .upsert({ app_id: appId, date, build_time_unit: buildTimeUnit, build_count: logs.length, updated_at: nowIso() }, { onConflict: 'app_id,date' })
    if (upsertError)
      throw upsertError
  }

  async listBuildLogsByOrg(orgId: string): Promise<BuildLogRecord[]> {
    const { data, error } = await this.client
      .from('build_logs')
      .select('build_id, org_id, user_id, app_id, platform, build_time_unit, billable_seconds, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (error)
      throw error
    return ((data ?? []) as BuildLogRow[]).map(toBuildLog)
  }

  async getDailyBuildTime(appId: string, date: string): Promise<BuildTimeMetricsRecord | undefined> {
    const { data, error } = await this.client
      .from('daily_build_time')
      .select('app_id, date, build_time_unit, build_count')
      .eq('app_id', appId)
      .eq('date', date)
      .maybeSingle<DailyBuildTimeRow>()
    if (error)
      throw error
    return data ? toDailyBuildTime(data) : undefined
  }

  async listDailyBuildTimeByOrg(orgId: string): Promise<BuildTimeMetricsRecord[]> {
    const { data: apps, error: appsError } = await this.client
      .from('apps')
      .select('app_id')
      .eq('owner_org', orgId)
    if (appsError)
      throw appsError
    const appIds = ((apps ?? []) as Array<{ app_id: string }>).map(app => app.app_id)
    if (appIds.length === 0)
      return []
    const { data, error } = await this.client
      .from('daily_build_time')
      .select('app_id, date, build_time_unit, build_count')
      .in('app_id', appIds)
      .order('date', { ascending: false })
    if (error)
      throw error
    return ((data ?? []) as DailyBuildTimeRow[]).map(toDailyBuildTime)
  }

  async recordMauUsage(input: RecordMauUsageInput): Promise<MauMetricsRecord> {
    const { data, error } = await this.client
      .from('daily_mau')
      .upsert({ app_id: input.appId, date: input.date, mau: Math.max(0, Math.ceil(input.mau)), updated_at: nowIso() }, { onConflict: 'app_id,date' })
      .select('app_id,date,mau')
      .single<DailyMauRow>()
    if (error)
      throw error
    return toDailyMau(data)
  }

  async listDailyMauByOrg(orgId: string): Promise<MauMetricsRecord[]> {
    const { data: apps, error: appsError } = await this.client
      .from('apps')
      .select('app_id')
      .eq('owner_org', orgId)
    if (appsError)
      throw appsError
    const appIds = ((apps ?? []) as Array<{ app_id: string }>).map(app => app.app_id)
    if (appIds.length === 0)
      return []
    const { data, error } = await this.client
      .from('daily_mau')
      .select('app_id,date,mau')
      .in('app_id', appIds)
      .order('date', { ascending: false })
    if (error)
      throw error
    return ((data ?? []) as DailyMauRow[]).map(toDailyMau)
  }

  async recordStats(event: StatsEvent): Promise<void> {
    const { error } = await this.client.from('stats_events').insert({
      app_id: event.app_id,
      bundle_id: event.bundle_id ?? event.app_id,
      device_id: event.device_id,
      platform: event.platform,
      version_name: event.version_name,
      action: event.action,
      plugin_version: event.plugin_version ?? null,
      metadata: event.metadata ?? null,
    })

    if (error)
      throw error
  }

  async listStatsEvents(query: ListStatsEventsQuery): Promise<StatsEventRecord[]> {
    const limit = Math.min(query.limit ?? 100, 1000)
    let request = this.client
      .from('stats_events')
      .select('app_id,bundle_id,device_id,platform,version_name,action,plugin_version,metadata,created_at')
      .eq('app_id', query.appId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (query.actions?.length)
      request = request.in('action', query.actions)
    if (query.devicesId?.length)
      request = request.in('device_id', query.devicesId)
    if (query.start_date)
      request = request.gte('created_at', query.start_date)
    if (query.end_date)
      request = request.lte('created_at', query.end_date)
    if (query.search)
      request = request.or(`device_id.ilike.%${query.search}%,version_name.ilike.%${query.search}%,action.ilike.%${query.search}%`)

    const { data, error } = await request
    if (error)
      throw error

    return ((data ?? []) as Array<{
      app_id: string
      bundle_id: string | null
      device_id: string
      platform: Platform
      version_name: string
      action: StatsEvent['action']
      plugin_version: string | null
      metadata: Record<string, unknown> | null
      created_at: string
    }>).map(row => ({
      app_id: row.app_id,
      bundle_id: row.bundle_id ?? undefined,
      device_id: row.device_id,
      platform: row.platform,
      version_name: row.version_name,
      action: row.action,
      plugin_version: row.plugin_version ?? undefined,
      metadata: row.metadata ?? undefined,
      created_at: row.created_at,
    }))
  }

  async recordEvent(event: ConsoleEvent): Promise<void> {
    const { error } = await this.client.from('console_events').insert({
      channel: event.channel,
      event: event.event,
      description: event.description ?? null,
      icon: event.icon ?? null,
      notify: event.notify ?? false,
      notify_console: event.notifyConsole ?? false,
      org_id: event.orgId ?? null,
      user_id: event.userId ?? null,
      tracking_version: event.trackingVersion ?? null,
      tags: event.tags ?? null,
      created_at: event.createdAt,
    })

    if (error)
      throw error
  }

  async createWebhook(input: CreateWebhookInput): Promise<WebhookRecord> {
    const secret = generateWebhookSecret()
    const { data, error } = await this.client
      .from('webhooks')
      .insert({
        org_id: input.orgId,
        name: input.name,
        url: input.url,
        secret,
        enabled: input.enabled ?? true,
        events: input.events,
        delivery_version: input.deliveryVersion,
        created_by: input.createdBy ?? null,
      })
      .select('id,org_id,name,url,secret,enabled,events,delivery_version,created_by,created_at,updated_at')
      .single<WebhookRow>()
    if (error)
      throw error
    return toWebhook(data, true)
  }

  async getWebhook(webhookId: string): Promise<WebhookRecord | undefined> {
    const { data, error } = await this.client
      .from('webhooks')
      .select('id,org_id,name,url,secret,enabled,events,delivery_version,created_by,created_at,updated_at')
      .eq('id', webhookId)
      .maybeSingle<WebhookRow>()
    if (error)
      throw error
    return data ? toWebhook(data, true) : undefined
  }

  async listWebhooks(orgId: string, page: number, perPage: number): Promise<WebhookRecord[]> {
    const { data, error } = await this.client
      .from('webhooks')
      .select('id,org_id,name,url,secret,enabled,events,delivery_version,created_by,created_at,updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(page * perPage, page * perPage + perPage - 1)
    if (error)
      throw error
    return ((data ?? []) as WebhookRow[]).map(row => toWebhook(row))
  }

  async updateWebhook(webhookId: string, input: UpdateWebhookInput): Promise<WebhookRecord | undefined> {
    const update: Record<string, unknown> = {}
    if (input.name !== undefined)
      update.name = input.name
    if (input.url !== undefined)
      update.url = input.url
    if (input.events !== undefined)
      update.events = input.events
    if (input.enabled !== undefined)
      update.enabled = input.enabled
    if (input.deliveryVersion !== undefined)
      update.delivery_version = input.deliveryVersion
    update.updated_at = nowIso()

    const { data, error } = await this.client
      .from('webhooks')
      .update(update)
      .eq('id', webhookId)
      .select('id,org_id,name,url,secret,enabled,events,delivery_version,created_by,created_at,updated_at')
      .maybeSingle<WebhookRow>()
    if (error)
      throw error
    return data ? toWebhook(data) : undefined
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('webhooks')
      .delete({ count: 'exact' })
      .eq('id', webhookId)
    if (error)
      throw error
    return (count ?? 0) > 0
  }

  async getWebhookStats(webhookId: string, sinceIso: string): Promise<WebhookStatsRecord> {
    const { data, error } = await this.client
      .from('webhook_deliveries')
      .select('status')
      .eq('webhook_id', webhookId)
      .gte('created_at', sinceIso)
    if (error)
      throw error
    const stats: WebhookStatsRecord = { success: 0, failed: 0, pending: 0 }
    for (const row of (data ?? []) as Array<{ status: WebhookDeliveryStatus }>)
      stats[row.status] += 1
    return stats
  }

  async createWebhookDelivery(input: CreateWebhookDeliveryInput): Promise<WebhookDeliveryRecord> {
    const { data, error } = await this.client
      .from('webhook_deliveries')
      .insert({
        id: input.id,
        webhook_id: input.webhookId,
        org_id: input.orgId,
        audit_log_id: input.auditLogId ?? null,
        event_type: input.eventType,
        status: input.status ?? 'pending',
        request_payload: input.requestPayload,
        response_status: input.responseStatus ?? null,
        response_body: input.responseBody ?? null,
        response_headers: input.responseHeaders ?? null,
        attempt_count: input.attemptCount ?? 0,
        max_attempts: input.maxAttempts ?? 10,
        delivery_version: input.deliveryVersion,
      })
      .select('*')
      .single<WebhookDeliveryRow>()
    if (error)
      throw error
    return toWebhookDelivery(data)
  }

  async getWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryRecord | undefined> {
    const { data, error } = await this.client
      .from('webhook_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .maybeSingle<WebhookDeliveryRow>()
    if (error)
      throw error
    return data ? toWebhookDelivery(data) : undefined
  }

  async updateWebhookDelivery(deliveryId: string, input: UpdateWebhookDeliveryInput): Promise<WebhookDeliveryRecord | undefined> {
    const update: Record<string, unknown> = {}
    if (input.status !== undefined)
      update.status = input.status
    if (Object.hasOwn(input, 'responseStatus'))
      update.response_status = input.responseStatus ?? null
    if (Object.hasOwn(input, 'responseBody'))
      update.response_body = input.responseBody ?? null
    if (Object.hasOwn(input, 'responseHeaders'))
      update.response_headers = input.responseHeaders ?? null
    if (input.attemptCount !== undefined)
      update.attempt_count = input.attemptCount
    if (Object.hasOwn(input, 'nextRetryAt'))
      update.next_retry_at = input.nextRetryAt ?? null
    if (Object.hasOwn(input, 'completedAt'))
      update.completed_at = input.completedAt ?? null
    if (Object.hasOwn(input, 'durationMs'))
      update.duration_ms = input.durationMs ?? null

    const { data, error } = await this.client
      .from('webhook_deliveries')
      .update(update)
      .eq('id', deliveryId)
      .select('*')
      .maybeSingle<WebhookDeliveryRow>()
    if (error)
      throw error
    return data ? toWebhookDelivery(data) : undefined
  }

  async listWebhookDeliveries(query: ListWebhookDeliveriesQuery): Promise<ListWebhookDeliveriesResult> {
    let countQuery = this.client
      .from('webhook_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('webhook_id', query.webhookId)
    let dataQuery = this.client
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', query.webhookId)
      .order('created_at', { ascending: false })
      .range(query.page * query.perPage, query.page * query.perPage + query.perPage - 1)
    if (query.status) {
      countQuery = countQuery.eq('status', query.status)
      dataQuery = dataQuery.eq('status', query.status)
    }
    const countResult = await countQuery
    if (countResult.error)
      throw countResult.error
    const { data, error } = await dataQuery
    if (error)
      throw error
    return { deliveries: ((data ?? []) as WebhookDeliveryRow[]).map(toWebhookDelivery), total: countResult.count ?? 0 }
  }
}
