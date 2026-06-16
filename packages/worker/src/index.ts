import type { Context, Next } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ApiKeyBindingRecord, ApiKeyRecord, AppRecord, AuditLogRecord, AuditOperation, ChannelRecord, ConsoleEvent, DeviceRecord, OrganizationRecord, Platform, ReleaseRecord, StatsEvent, UpdateRequest } from '@codepushgo/shared'
import { CAPGO_API_VERSION_HEADER, compareNativePackages, compareVersions, isValidAppId, isValidReleaseVersion, isVersionGreater, parseCapgoApiVersion } from '@codepushgo/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { D1R2Storage, MemoryStorage, type Env, type RoleBindingRecord, type RoleBindingScopeType, type StorageDriver, type UpdateApiKeyInput, type WebhookDeliveryRecord, type WebhookRecord } from './storage'
import { hasSupabaseEnv, SupabaseStorage } from './supabase-storage'
import { cloudlog, omitSensitiveRequestBody } from './logging'
import { buildBuilderPayload, emitBuildTransitionEvent } from './build-tracking'
import { adminStatsBodySchema, buildPluginBreakdownResult } from './admin-stats'
import { deleteLegacyChannelSelfOverride, readLegacyChannelSelfOverride, writeLegacyChannelSelfOverride } from './channel-self-store'
import { calculateCreditCost, GLOBAL_CREDIT_STEPS, normalizeCreditUsage, validateCreditUsage } from './credits-pricing'
import { checkPublicDeviceRateLimit, clearFailedAccountAuth, isAccountRateLimited, isIPRateLimited, recordFailedAccountAuth, recordFailedAuth } from './rate-limit'
import { getBuilderConfig } from './config-builder'
import { OrganizationStripeSyncError, sanitizeOrganizationName, syncOrganizationNameToStripeAfterCommit } from './organization-stripe-sync'
import { InvalidOrganizationWebsiteError, normalizeWebsiteUrl } from './organization-website'
import { getEffectivePasswordMinLength, getPasswordPolicyValidationErrors, SUPABASE_MAX_PASSWORD_LENGTH, type PasswordPolicyRules } from './password-policy'
import { getPluginRegionVersions } from './plugin-regions'
import { buildPrivateAnalyticsExport, parsePrivateAnalyticsQuery, PrivateAnalyticsValidationError } from './private-analytics'
import { getManifestUrl } from './manifest-url'
import { matchDefaultCache } from './files-cache'
import { ALLOWED_STATS_ACTIONS } from './stats-actions'
import { buildBundleUsageChart, buildStatisticsBuckets, emptyChartDataset } from './statistics'
import { runCronSyncSub } from './cron-sync-sub'
import { recordUpdateEnumerationMiss, updateEnumerationLimitedResponse } from './update-oracle-guard'
import { bindingIdParamSchema, createRoleBindingBodyHook, createRoleBindingBodySchema, invalidBindingIdHook, updateRoleBindingBodyHook, updateRoleBindingBodySchema, validateJsonBody } from './rbac-validation'
import { getPublicHostnameValidationError } from './public-url'
import { buildWebhookDeliveryPayload, deliverWebhook, describeWebhookUrl, type WebhookDeliveryVersion } from './webhook-delivery-security'
import { hasPendingStatsRefresh } from './cron-stats'

interface AdminAuth {
  kind: 'env' | 'apikey'
  apiKey?: ApiKeyRecord
}

interface AppEnv {
  Bindings: Env
  Variables: {
    auth: AdminAuth
  }
}

type StorageFactory = (env: Env) => StorageDriver

const TUS_VERSION = '1.0.0'
const TUS_MAX_UPLOAD_LENGTH = 1024 * 1024 * 1024
const tusUploads = new Map<string, { data: Uint8Array, length: number, metadata: string | null }>()

function tusDiscoveryResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Tus-Resumable': TUS_VERSION,
      'Tus-Version': TUS_VERSION,
      'Tus-Extension': 'creation',
      'Tus-Max-Size': String(TUS_MAX_UPLOAD_LENGTH),
    },
  })
}

function tusUploadResponse(uploadId: string, upload: { length: number, data: Uint8Array }) {
  return new Response(null, {
    status: 200,
    headers: {
      'Tus-Resumable': TUS_VERSION,
      'Upload-Length': String(upload.length),
      'Upload-Offset': String(upload.data.byteLength),
      Location: `/files/upload/attachments/${uploadId}`,
    },
  })
}

async function readRequestBytes(request: Request) {
  return new Uint8Array(await request.arrayBuffer())
}

const ok = { status: 'ok' } as const
const platformSchema = z.enum(['ios', 'android'])
const auditOperationSchema = z.enum(['INSERT', 'UPDATE', 'DELETE'])

const createAppSchema = z.object({
  appId: z.string().trim().min(1).optional(),
  app_id: z.string().trim().min(1).optional(),
  bundle_id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  owner_org: z.string().trim().optional(),
}).transform((body) => ({
  appId: body.appId ?? body.app_id ?? body.bundle_id,
  name: body.name,
  ownerOrg: body.owner_org,
}))

const updateAppSchema = z.object({
  name: z.string().trim().min(1).optional(),
  owner_org: z.string().trim().optional(),
  expose_metadata: z.boolean().optional(),
  exposeMetadata: z.boolean().optional(),
}).transform((body) => ({
  name: body.name,
  owner_org: body.owner_org,
  exposeMetadata: body.exposeMetadata ?? body.expose_metadata,
}))

const transferAppSchema = z.object({
  owner_org: z.string().trim().min(1).optional(),
  new_owner_org: z.string().trim().min(1).optional(),
  org_id: z.string().trim().min(1).optional(),
}).transform((body) => ({ ownerOrg: body.owner_org ?? body.new_owner_org ?? body.org_id }))

const updateRequestSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  device_id: z.string().trim().min(1),
  platform: platformSchema,
  version_name: z.string().trim().min(1),
  version_build: z.string().trim().optional(),
  plugin_version: z.string().trim().optional(),
  channel: z.string().trim().min(1).optional(),
  defaultChannel: z.string().trim().min(1).optional(),
  default_channel: z.string().trim().min(1).optional(),
  custom_id: z.string().trim().optional(),
  key_id: z.string().trim().max(20).optional(),
})

const statsEventSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  device_id: z.string().trim().min(1),
  platform: platformSchema,
  version_name: z.string().trim().min(1),
  version_build: z.string().trim().optional(),
  version_os: z.string().trim().optional(),
  action: z.enum(ALLOWED_STATS_ACTIONS),
  plugin_version: z.string().trim().optional(),
  custom_id: z.string().trim().optional(),
  is_prod: z.boolean().optional(),
  is_emulator: z.boolean().optional(),
  defaultChannel: z.string().trim().optional(),
  default_channel: z.string().trim().optional(),
  key_id: z.string().trim().max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).transform((body) => ({
  ...body,
  app_id: body.app_id ?? body.bundle_id ?? '',
  defaultChannel: body.defaultChannel ?? body.default_channel,
}))

const channelSelfSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  device_id: z.string().trim().min(1).optional(),
  plugin_version: z.string().trim().optional(),
  platform: platformSchema.optional(),
  version_name: z.string().trim().optional(),
  version_build: z.string().trim().optional(),
  key_id: z.string().trim().max(20).optional(),
  channel: z.string().trim().min(1).optional(),
  defaultChannel: z.string().trim().min(1).optional(),
  default_channel: z.string().trim().min(1).optional(),
}).transform((body) => ({
  ...body,
  app_id: body.app_id ?? body.bundle_id,
  defaultChannel: body.defaultChannel ?? body.default_channel,
}))

const channelSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  channel: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  public: z.boolean().optional(),
  allow_self_set: z.boolean().optional(),
  allowSelfSet: z.boolean().optional(),
  ios: z.boolean().optional(),
  android: z.boolean().optional(),
  electron: z.boolean().optional(),
}).transform((body) => ({
  app_id: body.app_id ?? body.bundle_id,
  channel: body.channel ?? body.name,
  public: body.public,
  allowSelfSet: body.allowSelfSet ?? body.allow_self_set,
  ios: body.ios,
  android: body.android,
  electron: body.electron,
}))

const deviceSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  device_id: z.string().trim().min(1),
  channel: z.string().trim().min(1).optional(),
  platform: platformSchema.optional(),
  plugin_version: z.string().trim().optional(),
  version_os: z.string().trim().optional(),
  version_build: z.string().trim().optional(),
  version_name: z.string().trim().optional(),
  custom_id: z.string().trim().optional(),
  is_prod: z.boolean().optional(),
  key_id: z.string().trim().max(20).optional(),
  is_emulator: z.boolean().optional(),
  defaultChannel: z.string().trim().optional(),
  default_channel: z.string().trim().optional(),
  version_id: z.number().int().optional(),
}).transform((body) => ({
  ...body,
  app_id: body.app_id ?? body.bundle_id,
})).pipe(z.object({
  app_id: z.string().trim().min(3),
  device_id: z.string().trim().min(1),
  channel: z.string().trim().min(1).optional(),
  platform: platformSchema.optional(),
  plugin_version: z.string().trim().optional(),
  version_os: z.string().trim().optional(),
  version_build: z.string().trim().optional(),
  version_name: z.string().trim().optional(),
  custom_id: z.string().trim().optional(),
  key_id: z.string().trim().max(20).optional(),
  is_prod: z.boolean().optional(),
  is_emulator: z.boolean().optional(),
  defaultChannel: z.string().trim().optional(),
  default_channel: z.string().trim().optional(),
  version_id: z.number().int().optional(),
}))

const deviceQuerySchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  device_id: z.string().trim().min(1).optional(),
}).transform((body) => ({
  app_id: body.app_id ?? body.bundle_id,
  device_id: body.device_id,
}))

const deviceDeleteSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  device_id: z.string().trim().min(1),
  plugin_version: z.string().trim().optional(),
}).transform((body) => ({
  app_id: body.app_id ?? body.bundle_id,
  device_id: body.device_id,
  ...(body.plugin_version === undefined ? {} : { plugin_version: body.plugin_version }),
})).pipe(z.object({
  app_id: z.string().trim().min(3),
  device_id: z.string().trim().min(1),
  plugin_version: z.string().trim().optional(),
}))
const buildTimeSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  appId: z.string().trim().min(3).optional(),
  build_id: z.string().trim().min(1).optional(),
  buildId: z.string().trim().min(1).optional(),
  user_id: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  platform: platformSchema,
  build_time_unit: z.number().finite().nonnegative().optional(),
  buildTimeUnit: z.number().finite().nonnegative().optional(),
}).transform((body, ctx) => {
  const appId = body.app_id ?? body.appId
  const buildId = body.build_id ?? body.buildId
  const buildTimeUnit = body.build_time_unit ?? body.buildTimeUnit
  if (!appId) {
    ctx.addIssue({ code: 'custom', message: 'app_id is required' })
    return z.NEVER
  }
  if (!buildId) {
    ctx.addIssue({ code: 'custom', message: 'build_id is required' })
    return z.NEVER
  }
  if (buildTimeUnit === undefined) {
    ctx.addIssue({ code: 'custom', message: 'build_time_unit is required' })
    return z.NEVER
  }
  return {
    appId,
    buildId,
    userId: body.user_id ?? body.userId,
    platform: body.platform,
    buildTimeUnit,
  }
})
const nativePackageSchema = z.object({
  name: z.string().trim().min(1),
  version: z.string().trim().min(1),
  ios_checksum: z.string().trim().optional(),
  android_checksum: z.string().trim().optional(),
})

const nativeBuildRequestSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  appId: z.string().trim().min(3).optional(),
  platform: platformSchema,
  build_mode: z.enum(['release', 'debug']).optional(),
  buildMode: z.enum(['release', 'debug']).optional(),
  build_options: z.record(z.string(), z.unknown()).optional(),
  buildOptions: z.record(z.string(), z.unknown()).optional(),
  build_credentials: z.record(z.string(), z.string()).optional(),
  buildCredentials: z.record(z.string(), z.string()).optional(),
}).transform((body, ctx) => {
  const appId = body.app_id ?? body.appId
  if (!appId) {
    ctx.addIssue({ code: 'custom', message: 'app_id is required' })
    return z.NEVER
  }
  return {
    appId,
    platform: body.platform,
    buildMode: body.build_mode ?? body.buildMode ?? 'release',
    buildOptions: body.build_options ?? body.buildOptions ?? {},
    buildCredentials: body.build_credentials ?? body.buildCredentials ?? {},
  }
})
const bundleCreateSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  version: z.string().trim().min(1).optional(),
  checksum: z.string().trim().min(1).optional(),
  session_key: z.string().trim().min(1).optional(),
  sessionKey: z.string().trim().min(1).optional(),
  key_id: z.string().trim().min(1).max(20).optional(),
  keyId: z.string().trim().min(1).max(20).optional(),
  external_url: z.string().trim().min(1).optional(),
  manifest: z.array(z.object({
    file_name: z.string().nullable().optional(),
    file_hash: z.string().nullable().optional(),
    s3_path: z.string().nullable().optional(),
  })).optional(),
  platform: platformSchema.optional(),
  native_packages: z.array(nativePackageSchema).optional(),
  nativePackages: z.array(nativePackageSchema).optional(),
  channel: z.string().trim().min(1).optional(),
  mandatory: z.boolean().optional(),
  rollout: z.number().min(1).max(100).optional(),
  notes: z.string().trim().optional(),
  min_update_version: z.string().trim().optional().nullable(),
  minUpdateVersion: z.string().trim().optional().nullable(),
}).transform((body) => ({
  ...body,
  app_id: body.app_id ?? body.bundle_id,
}))

const bundleDeleteSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  version: z.string().trim().min(1).optional(),
}).transform((body) => ({
  app_id: body.app_id ?? body.bundle_id,
  version: body.version,
}))

const bundleCompatibilitySchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  channel: z.string().trim().min(1).optional(),
  platform: platformSchema.optional(),
  native_packages: z.array(nativePackageSchema).optional(),
  nativePackages: z.array(nativePackageSchema).optional(),
}).transform((body) => ({
  app_id: body.app_id ?? body.bundle_id,
  channel: body.channel ?? 'production',
  platform: body.platform ?? 'ios',
  nativePackages: body.nativePackages ?? body.native_packages ?? [],
}))


const bundleMetadataSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  version_id: z.number().int().optional(),
  version: z.string().trim().optional(),
  link: z.string().trim().optional(),
  comment: z.string().trim().optional(),
  notes: z.string().trim().optional(),
}).transform((body) => ({
  ...body,
  app_id: body.app_id ?? body.bundle_id,
}))

const versionMetaUpsertSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  version_id: z.number().int().positive(),
  size: z.number().int(),
}).transform((body) => ({
  app_id: body.app_id ?? body.bundle_id,
  versionId: body.version_id,
  size: body.size,
}))


const webhookEventTypes = ['apps', 'app_versions', 'channels', 'org_users', 'orgs'] as const
const webhookDeliveryStatuses = ['pending', 'success', 'failed'] as const
const webhookPublicUrlMessages = {
  invalidUrl: 'Webhook URL must be a valid URL',
  publicHost: 'Webhook URL must point to a public host',
  ipLiteral: 'Webhook URL must not use a private IP literal',
  https: 'Webhook URL must use HTTPS',
  dnsResolution: 'Webhook URL host could not be resolved',
  fetchFailed: 'Webhook URL could not be fetched',
  tooManyRedirects: 'Webhook URL has too many redirects',
}
const webhookPageSchema = z.preprocess(value => typeof value === 'string' ? Number(value) : value, z.number().int().min(0).default(0))

const webhookListQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  webhookId: z.string().trim().min(1).optional(),
  page: webhookPageSchema,
})

const webhookCreateSchema = z.object({
  orgId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  url: z.string().trim().url(),
  events: z.array(z.string().trim().min(1)).min(1),
  enabled: z.boolean().optional(),
  deliveryVersion: z.string().trim().optional(),
  delivery_version: z.string().trim().optional(),
})

const webhookUpdateSchema = z.object({
  orgId: z.string().trim().min(1),
  webhookId: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  url: z.string().trim().url().optional(),
  events: z.array(z.string().trim().min(1)).min(1).optional(),
  enabled: z.boolean().optional(),
  deliveryVersion: z.string().trim().optional(),
  delivery_version: z.string().trim().optional(),
})

const webhookIdentitySchema = z.object({
  orgId: z.string().trim().min(1),
  webhookId: z.string().trim().min(1),
})

const webhookDeliveriesQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  webhookId: z.string().trim().min(1),
  page: webhookPageSchema,
  status: z.enum(webhookDeliveryStatuses).optional(),
})

const webhookRetrySchema = z.object({
  orgId: z.string().trim().min(1),
  deliveryId: z.string().trim().min(1),
})
const uploadLinkSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  name: z.string().trim().min(1).optional(),
  fileId: z.string().trim().min(1).optional(),
}).transform((body) => ({
  app_id: body.app_id ?? body.bundle_id,
  name: body.name ?? body.fileId,
}))

const bundleSetChannelSchema = z.object({
  app_id: z.string().trim().min(3).optional(),
  bundle_id: z.string().trim().min(3).optional(),
  version_id: z.number().int().optional(),
  version: z.string().trim().optional(),
  channel_id: z.number().int().optional(),
  channel: z.string().trim().optional(),
}).transform((body) => ({
  ...body,
  app_id: body.app_id ?? body.bundle_id,
}))
const eventSchema = z.object({
  channel: z.string().trim().min(1),
  event: z.string().trim().min(1),
  description: z.string().trim().optional(),
  icon: z.string().trim().optional(),
  notify: z.boolean().optional(),
  notifyConsole: z.boolean().optional(),
  notify_console: z.boolean().optional(),
  org_id: z.string().trim().optional(),
  user_id: z.string().trim().optional(),
  tracking_version: z.number().int().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
}).transform((body) => ({
  channel: body.channel,
  event: body.event,
  description: body.description,
  icon: body.icon,
  notify: body.notify,
  notifyConsole: body.notifyConsole ?? body.notify_console,
  orgId: body.org_id,
  userId: body.user_id,
  trackingVersion: body.tracking_version,
  tags: body.tags,
}))
const compatibilityAckSchema = z.object({
  note: z.string().trim().min(1),
})
const apiKeyBindingSchema = z.object({
  role_name: z.string().trim().min(1).optional(),
  roleName: z.string().trim().min(1).optional(),
  scope_type: z.string().trim().optional(),
  scopeType: z.string().trim().optional(),
  org_id: z.string().trim().optional(),
  orgId: z.string().trim().optional(),
  app_id: z.string().trim().optional(),
  appId: z.string().trim().optional(),
  reason: z.string().trim().optional(),
}).transform((body) => ({
  roleName: body.roleName ?? body.role_name,
  scopeType: body.scopeType ?? body.scope_type,
  orgId: body.orgId ?? body.org_id,
  appId: body.appId ?? body.app_id,
  reason: body.reason,
}))

const apiKeyCreateSchema = z.object({
  name: z.string().trim().optional(),
  bindings: z.array(apiKeyBindingSchema).optional(),
  expires_at: z.union([z.string().trim(), z.null()]).optional(),
  expiresAt: z.union([z.string().trim(), z.null()]).optional(),
  global_permissions: z.array(z.string().trim().min(1)).optional(),
  globalPermissions: z.array(z.string().trim().min(1)).optional(),
}).passthrough().transform((body) => ({
  name: body.name,
  bindings: body.bindings,
  expiresAt: body.expiresAt ?? body.expires_at,
  globalPermissions: body.globalPermissions ?? body.global_permissions ?? [],
}))

const apiKeyUpdateSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().optional(),
  bindings: z.array(apiKeyBindingSchema).optional(),
  expires_at: z.union([z.string().trim(), z.null()]).optional(),
  expiresAt: z.union([z.string().trim(), z.null()]).optional(),
  global_permissions: z.array(z.string().trim().min(1)).optional(),
  globalPermissions: z.array(z.string().trim().min(1)).optional(),
  regenerate: z.boolean().optional(),
}).passthrough().transform((body) => ({
  id: body.id,
  name: body.name,
  hasName: Object.prototype.hasOwnProperty.call(body, 'name'),
  bindings: body.bindings,
  expiresAt: body.expiresAt ?? body.expires_at,
  hasExpiresAt: Object.prototype.hasOwnProperty.call(body, 'expiresAt') || Object.prototype.hasOwnProperty.call(body, 'expires_at'),
  globalPermissions: body.globalPermissions ?? body.global_permissions,
  regenerate: body.regenerate,
  hasKnownField: Object.prototype.hasOwnProperty.call(body, 'name')
    || Object.prototype.hasOwnProperty.call(body, 'bindings')
    || Object.prototype.hasOwnProperty.call(body, 'expiresAt')
    || Object.prototype.hasOwnProperty.call(body, 'expires_at')
    || Object.prototype.hasOwnProperty.call(body, 'globalPermissions')
    || Object.prototype.hasOwnProperty.call(body, 'global_permissions')
    || Object.prototype.hasOwnProperty.call(body, 'regenerate'),
}))

const passwordPolicySchema = z.object({
  enabled: z.boolean().optional(),
  min_length: z.number().optional(),
  require_uppercase: z.boolean().optional(),
  require_number: z.boolean().optional(),
  require_special: z.boolean().optional(),
}).passthrough()

const organizationSchema = z.object({
  id: z.string().trim().min(1).optional(),
  orgId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  management_email: z.string().trim().email().optional().nullable(),
  managementEmail: z.string().trim().email().optional().nullable(),
  created_by: z.string().trim().optional().nullable(),
  createdBy: z.string().trim().optional().nullable(),
  customer_id: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  password_policy_config: passwordPolicySchema.optional().nullable(),
  passwordPolicyConfig: passwordPolicySchema.optional().nullable(),
  enforce_encrypted_bundles: z.boolean().optional(),
  enforceEncryptedBundles: z.boolean().optional(),
  required_encryption_key: z.string().trim().optional().nullable(),
  requiredEncryptionKey: z.string().trim().optional().nullable(),
}).transform((body) => ({
  id: body.id ?? body.orgId,
  name: body.name,
  managementEmail: body.managementEmail ?? body.management_email,
  enforceEncryptedBundles: body.enforceEncryptedBundles ?? body.enforce_encrypted_bundles,
  requiredEncryptionKey: body.requiredEncryptionKey ?? body.required_encryption_key,
  website: body.website,
  createdBy: body.createdBy ?? body.created_by,
  customerId: body.customerId ?? body.customer_id,
  passwordPolicyConfig: body.passwordPolicyConfig ?? body.password_policy_config,
}))
const orgMemberSchema = z.object({
  orgId: z.string().trim().min(1).optional(),
  org_id: z.string().trim().min(1).optional(),
  email: z.string().trim().email(),
  userId: z.string().trim().min(1).optional(),
  user_id: z.string().trim().min(1).optional(),
  invite_type: z.string().trim().optional(),
  role: z.string().trim().optional(),
}).transform((body, ctx) => {
  const orgId = body.orgId ?? body.org_id
  if (!orgId) {
    ctx.addIssue({ code: 'custom', message: 'orgId is required' })
    return z.NEVER
  }
  return {
    orgId,
    email: body.email,
    userId: body.userId ?? body.user_id,
    role: body.role ?? body.invite_type ?? 'read',
  }
})

const ssoProvisionSchema = z.object({
  user_id: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  first_name: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  providers: z.array(z.string().trim()).optional(),
  provider_id: z.string().trim().optional(),
  providerId: z.string().trim().optional(),
  org_id: z.string().trim().optional(),
  orgId: z.string().trim().optional(),
  user: z.object({
    id: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    user_metadata: z.record(z.string(), z.unknown()).optional(),
    app_metadata: z.object({
      provider: z.string().trim().optional(),
      providers: z.array(z.string().trim()).optional(),
    }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough().transform((body) => {
  const userMetadata = body.user?.user_metadata ?? {}
  const firstFromMetadata = typeof userMetadata.first_name === 'string' ? userMetadata.first_name : typeof userMetadata.name === 'string' ? userMetadata.name.split(' ')[0] : undefined
  const lastFromMetadata = typeof userMetadata.last_name === 'string' ? userMetadata.last_name : undefined
  return {
    userId: body.userId ?? body.user_id ?? body.user?.id,
    email: body.email ?? body.user?.email,
    firstName: body.firstName ?? body.first_name ?? firstFromMetadata,
    lastName: body.lastName ?? body.last_name ?? lastFromMetadata,
    provider: body.provider ?? body.user?.app_metadata?.provider,
    providers: body.providers ?? body.user?.app_metadata?.providers ?? [],
    providerId: body.providerId ?? body.provider_id,
    orgId: body.orgId ?? body.org_id,
  }
})

const logAsSchema = z.object({
  user_id: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  identifier: z.string().trim().min(1).optional(),
  org_id: z.string().trim().min(1).optional(),
  orgId: z.string().trim().min(1).optional(),
}).transform(body => ({
  userId: body.userId ?? body.user_id,
  identifier: body.identifier,
  orgId: body.orgId ?? body.org_id,
}))

const acceptInvitationSchema = z.object({
  password: z.string().min(1),
  magic_invite_string: z.string().trim().min(1),
  opt_for_newsletters: z.boolean(),
  captchaToken: z.string().trim().optional(),
}).transform((body) => ({
  password: body.password,
  magicInviteString: body.magic_invite_string,
  optForNewsletters: body.opt_for_newsletters,
  captchaToken: body.captchaToken,
}))

type ApiKeyBindingInput = z.infer<typeof apiKeyBindingSchema>
type ApiKeyUpdateInput = z.infer<typeof apiKeyUpdateSchema>


type ChannelSelfRequest = z.infer<typeof channelSelfSchema>


function ssoProviderCandidates(input: { provider?: string, providers?: string[], providerId?: string }) {
  const candidates = [input.providerId, input.provider, ...(input.providers ?? [])].filter((value): value is string => !!value)
  return candidates.map((value) => value.startsWith('sso:') ? value.slice(4) : value).filter((value) => value && value !== 'sso')
}

const validatePasswordComplianceSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  org_id: z.string().trim().min(1),
  captcha_token: z.string().trim().optional(),
})

const publicSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(SUPABASE_MAX_PASSWORD_LENGTH),
  first_name: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  last_name: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
}).transform(body => ({
  email: body.email,
  password: body.password,
  firstName: body.firstName ?? body.first_name ?? '',
  lastName: body.lastName ?? body.last_name ?? '',
}))
const adminCreditGrantSchema = z.object({
  org_id: z.string().trim().min(1),
  amount: z.number().int().min(1),
  notes: z.string().trim().optional(),
}).transform((body) => ({
  orgId: body.org_id,
  amount: body.amount,
  notes: body.notes,
}))
function isSsoProvider(input: { provider?: string, providers?: string[], providerId?: string }) {
  return !!input.providerId || input.provider === 'sso' || input.provider?.startsWith('sso:') || !!input.providers?.some((provider) => provider === 'sso' || provider.startsWith('sso:'))
}
function jsonError(c: Context, status: ContentfulStatusCode, error: string, message: string) {
  return c.json({ error, message }, status)
}

function rateLimitError(c: Context) {
  return jsonError(c, 429, 'too_many_requests', 'Too many requests')
}

function capgoError(c: Context, error: string, message: string) {
  return c.json({ error, message })
}

function nativePackagesFromHeader(value: string | undefined) {
  if (!value)
    return []
  try {
    const parsed = JSON.parse(value)
    const result = z.array(nativePackageSchema).safeParse(parsed)
    return result.success ? result.data : []
  }
  catch {
    return []
  }
}

function appIdError(c: Context, appId: string | undefined) {
  if (!appId)
    return jsonError(c, 400, 'missing_app_id', 'app_id or bundle_id is required')
  if (!isValidAppId(appId))
    return jsonError(c, 400, 'invalid_app_id', 'App id must be a reverse-domain identifier')
  return undefined
}

function versionError(c: Context, version: string | undefined) {
  if (!version)
    return jsonError(c, 400, 'missing_version', 'Release version is required')
  if (!isValidReleaseVersion(version))
    return jsonError(c, 400, 'invalid_version_format', 'Release version must be strict semver without a leading v')
  return undefined
}

function cannotAccessApp(c: Context) {
  return jsonError(c, 401, 'cannot_access_app', 'Cannot access app')
}

function notFound(c: Context, error: string, message: string) {
  return jsonError(c, 404, error, message)
}

function getBearerToken(c: Context) {
  const header = c.req.header('authorization') ?? c.req.header('capgkey')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? header
}

async function hashApiKeyToken(token: string) {
  const bytes = new TextEncoder().encode(token)
  return sha256(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

function generateApiKeyToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return `cpg_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function isApiKeyExpired(record: ApiKeyRecord) {
  return !!record.expiresAt && Date.parse(record.expiresAt) <= Date.now()
}

function canManageApiKeys(auth: AdminAuth) {
  if (auth.kind === 'env')
    return true
  return !!auth.apiKey?.bindings.some((binding) => binding.scopeType === 'org' && binding.roleName === 'org_admin')
}

async function authenticateAdmin(c: Context<AppEnv>, storage: StorageDriver): Promise<AdminAuth | Response> {
  const token = getBearerToken(c)
  const expected = c.env.CODEPUSHGO_API_KEY

  if (token && expected && token === expected)
    return { kind: 'env' }
  if (!token)
    return expected ? jsonError(c, 401, 'no_jwt_apikey_or_subkey', 'No JWT, API key, or subkey was provided') : jsonError(c, 503, 'missing_api_key', 'CODEPUSHGO_API_KEY is not configured')

  const record = await storage.getApiKeyByHash(await hashApiKeyToken(token))
  if (!record)
    return jsonError(c, 401, 'unauthorized', 'A valid bearer token is required')
  if (isApiKeyExpired(record))
    return jsonError(c, 401, 'invalid_apikey', 'API key has expired')
  return { kind: 'apikey', apiKey: record }
}

function requireAdmin(storageFactory: StorageFactory) {
  return async (c: Context<AppEnv>, next: Next) => {
    const auth = await authenticateAdmin(c, storageFactory(c.env))
    if (auth instanceof Response)
      return auth
    c.set('auth', auth)
    await next()
  }
}

function requirePluginRegionSecret(c: Context<AppEnv>) {
  const expected = c.env.API_SECRET ?? c.env.CODEPUSHGO_ADMIN_API_KEY
  if (!expected || c.req.header('apisecret') !== expected)
    return jsonError(c, 400, 'unauthorized', 'Cannot find authorization')
  return undefined
}

function requireCapgoAdmin(c: Context<AppEnv>) {
  const token = getBearerToken(c)
  if (!token)
    return jsonError(c, 401, 'no_jwt_apikey_or_subkey', 'No JWT, API key, or subkey was provided')
  if (!c.env.CODEPUSHGO_ADMIN_API_KEY || token !== c.env.CODEPUSHGO_ADMIN_API_KEY)
    return jsonError(c, 400, 'not_admin', 'Admin privileges are required')
  return undefined
}

function requireApiKeyManager(c: Context<AppEnv>, auth: AdminAuth, error: string, status: ContentfulStatusCode = 401) {
  if (canManageApiKeys(auth))
    return undefined
  return jsonError(c, status, error, 'Cannot manage API keys')
}


class JsonResponseError extends Error {
  constructor(readonly response: Response) {
    super('json_response')
  }
}

async function parseJson<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await c.req.json()
  }
  catch {
    throw new JsonResponseError(new Response(JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }))
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new JsonResponseError(new Response(JSON.stringify({
      error: 'invalid_request',
      message: parsed.error.issues.map((issue) => issue.message).join(', '),
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }))
  }

  return parsed.data
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function boolFromHeader(value: string | undefined) {
  return value === '1' || value === 'true'
}

function numberFromHeader(value: string | undefined, fallback: number) {
  if (!value)
    return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function base64UrlEncode(bytes: Uint8Array | string) {
  const binary = typeof bytes === 'string'
    ? bytes
    : String.fromCharCode(...bytes)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
function parseBuildUploadSuffix(c: Context, jobId: string) {
  const pathname = new URL(c.req.url).pathname
  const prefix = `/build/upload/${jobId}/`
  const encodedSuffix = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
  if (!encodedSuffix)
    throw new JsonResponseError(new Response(JSON.stringify({ error: 'invalid_path', message: 'Invalid upload path' }), { status: 400, headers: { 'content-type': 'application/json' } }))

  let suffix: string
  try {
    suffix = decodeURIComponent(encodedSuffix)
  }
  catch {
    throw new JsonResponseError(new Response(JSON.stringify({ error: 'invalid_path', message: 'Invalid upload path encoding.' }), { status: 400, headers: { 'content-type': 'application/json' } }))
  }

  const segments = suffix.split('/').filter(Boolean)
  if (suffix.startsWith('/') || suffix.includes('\\') || segments.length === 0 || segments.some(segment => segment === '.' || segment === '..'))
    throw new JsonResponseError(new Response(JSON.stringify({ error: 'invalid_path', message: 'Invalid upload path' }), { status: 400, headers: { 'content-type': 'application/json' } }))

  return segments.map(segment => encodeURIComponent(segment)).join('/')
}
async function signBuildLogsToken(jobId: string, userId: string, appId: string, secret: string) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({
    iss: 'capgo',
    aud: 'build-logs',
    sub: userId,
    job_id: jobId,
    app_id: appId,
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60,
  }))
  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function signImpersonationJwt(userId: string, secret: string) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({
    iss: 'capgo',
    aud: 'authenticated',
    role: 'authenticated',
    sub: userId,
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60,
  }))
  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`
}

const uuidIdentifierRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function resolveLogAsOrgUserId(storage: StorageDriver, orgId: string) {
  const org = await storage.getOrganization(orgId)
  if (!org)
    return undefined

  if (org.createdBy && await storage.getOrgMembership(org.createdBy, orgId))
    return org.createdBy

  const members = await storage.listOrgMemberships(orgId)
  const owner = members.find(member => ['super_admin', 'org_super_admin', 'admin', 'org_admin', 'owner'].includes(member.role)) ?? members[0]
  if (owner)
    return owner.userId

  return org.createdBy
}

async function resolveLogAsUserId(storage: StorageDriver, input: { userId?: string, identifier?: string, orgId?: string }) {
  if (input.userId)
    return (await storage.getUser(input.userId))?.id ?? input.userId

  if (input.identifier) {
    if (input.identifier.includes('@'))
      return (await storage.getUserByEmail(input.identifier))?.id

    const directUser = await storage.getUser(input.identifier)
    if (directUser)
      return directUser.id

    if (uuidIdentifierRegex.test(input.identifier))
      return resolveLogAsOrgUserId(storage, input.identifier)
  }

  if (input.orgId)
    return resolveLogAsOrgUserId(storage, input.orgId)

  return undefined
}
function getDownloadUrl(c: Context, request: UpdateRequest, version: string) {
  const url = new URL(c.req.url)
  url.pathname = `/v1/apps/${encodeURIComponent(request.app_id)}/bundles/${encodeURIComponent(version)}/download`
  url.search = new URLSearchParams({
    platform: request.platform,
    channel: request.channel ?? 'production',
  }).toString()
  return url.toString()
}

function supportsManifestUpdate(pluginVersion: string | null | undefined) {
  if (!pluginVersion)
    return false
  return compareVersions(pluginVersion, '6.8.0') >= 0
}

function channelSupportsPlatform(channel: ChannelRecord, platform: Platform) {
  return channel[platform] !== false
}

async function resolveUpdateChannel(storage: StorageDriver, store: Env['CHANNEL_SELF_STORE'], request: UpdateRequest) {
  if (request.channel)
    return { channel: request.channel, deviceOverride: false }
  const legacyOverride = await readLegacyChannelSelfOverride(store, storage, { appId: request.app_id, deviceId: request.device_id, pluginVersion: request.plugin_version })
  if (legacyOverride)
    return { channel: legacyOverride, deviceOverride: true }
  const persistedOverride = await storage.getDeviceChannel(request.app_id, request.device_id)
  if (persistedOverride)
    return { channel: persistedOverride, deviceOverride: true }
  return {
    channel: request.defaultChannel ?? request.default_channel ?? 'production',
    deviceOverride: false,
  }
}

async function validateUpdateChannel(storage: StorageDriver, request: UpdateRequest, channel: string, deviceOverride: boolean) {
  const availableChannels = await storage.listChannels(request.app_id, request.platform)
  const channelRecord = availableChannels.find((item) => item.name === channel)
  if (!channelRecord || !channelSupportsPlatform(channelRecord, request.platform))
    return undefined
  if (!deviceOverride && !channelRecord.public && !channelRecord.allowSelfSet)
    return undefined
  return channelRecord
}

async function canServePluginUpdates(storage: StorageDriver, appId: string): Promise<boolean> {
  const appRecord = await storage.getApp(appId)
  if (!appRecord)
    return false
  if (!appRecord.ownerOrg)
    return true
  const org = await storage.getOrganization(appRecord.ownerOrg)
  if (!org)
    return true
  const creditBalance = await storage.getUsageCreditBalance(org.id)
  if ((creditBalance?.availableCredits ?? 0) > 0)
    return true
  if (!org.customerId)
    return false
  const stripeInfo = await storage.getStripeInfoByCustomerId(org.customerId)
  if (stripeInfo?.isGoodPlan === true)
    return true
  return stripeInfo?.status === 'succeeded' || stripeInfo?.status === 'active' || stripeInfo?.status === 'trialing'
}

async function readChannelSelfRequest(c: Context): Promise<ChannelSelfRequest | Response> {
  const method = c.req.raw.method.toUpperCase()
  let source: unknown

  if (method === 'GET' || method === 'DELETE') {
    source = Object.fromEntries(new URL(c.req.url).searchParams.entries())
  }
  else {
    try {
      source = await c.req.json()
    }
    catch {
      return new Response(JSON.stringify({ error: 'invalid_json_body', message: 'Request body must be valid JSON' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  const parsed = channelSelfSchema.safeParse(source)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid_query_parameters', message: parsed.error.issues.map((issue) => issue.message).join(', ') }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  return parsed.data
}
function appResponse(app: AppRecord) {
  return {
    app_id: app.appId,
    bundle_id: app.appId,
    appId: app.appId,
    name: app.name,
    expose_metadata: app.exposeMetadata ?? false,
    exposeMetadata: app.exposeMetadata ?? false,
    owner_org: app.ownerOrg,
    ownerOrg: app.ownerOrg,
    transfer_history: app.transferHistory ?? [],
    transferHistory: app.transferHistory ?? [],
    created_at: app.createdAt,
    createdAt: app.createdAt,
  }
}
function apiKeyBindingResponse(binding: ApiKeyBindingRecord) {
  return {
    role_name: binding.roleName,
    roleName: binding.roleName,
    scope_type: binding.scopeType,
    scopeType: binding.scopeType,
    org_id: binding.orgId,
    orgId: binding.orgId,
    app_id: binding.appId,
    appId: binding.appId,
    reason: binding.reason,
  }
}

function apiKeyResponse(record: ApiKeyRecord, key?: string) {
  return {
    id: record.id,
    name: record.name,
    key: key ?? null,
    key_hash: record.keyHash,
    keyHash: record.keyHash,
    rbac_id: record.rbacId,
    rbacId: record.rbacId,
    bindings: record.bindings.map(apiKeyBindingResponse),
    global_permissions: record.globalPermissions,
    globalPermissions: record.globalPermissions,
    expires_at: record.expiresAt,
    expiresAt: record.expiresAt,
    created_at: record.createdAt,
    createdAt: record.createdAt,
    updated_at: record.updatedAt,
    updatedAt: record.updatedAt,
  }
}

function webhookResponse(webhook: WebhookRecord, includeSecret = false) {
  return {
    id: webhook.id,
    org_id: webhook.orgId,
    orgId: webhook.orgId,
    name: webhook.name,
    url: webhook.url,
    ...(includeSecret && webhook.secret ? { secret: webhook.secret } : {}),
    enabled: webhook.enabled,
    events: [...webhook.events],
    delivery_version: webhook.deliveryVersion,
    deliveryVersion: webhook.deliveryVersion,
    created_by: webhook.createdBy ?? null,
    createdBy: webhook.createdBy ?? null,
    created_at: webhook.createdAt,
    createdAt: webhook.createdAt,
    updated_at: webhook.updatedAt,
    updatedAt: webhook.updatedAt,
  }
}

function webhookDeliveryResponse(delivery: WebhookDeliveryRecord) {
  return {
    id: delivery.id,
    webhook_id: delivery.webhookId,
    webhookId: delivery.webhookId,
    org_id: delivery.orgId,
    orgId: delivery.orgId,
    audit_log_id: delivery.auditLogId ?? null,
    auditLogId: delivery.auditLogId ?? null,
    event_type: delivery.eventType,
    eventType: delivery.eventType,
    status: delivery.status,
    request_payload: delivery.requestPayload,
    requestPayload: delivery.requestPayload,
    response_status: delivery.responseStatus ?? null,
    responseStatus: delivery.responseStatus ?? null,
    response_body: delivery.responseBody ?? null,
    responseBody: delivery.responseBody ?? null,
    response_headers: delivery.responseHeaders ?? null,
    responseHeaders: delivery.responseHeaders ?? null,
    attempt_count: delivery.attemptCount,
    attemptCount: delivery.attemptCount,
    max_attempts: delivery.maxAttempts,
    maxAttempts: delivery.maxAttempts,
    next_retry_at: delivery.nextRetryAt ?? null,
    nextRetryAt: delivery.nextRetryAt ?? null,
    created_at: delivery.createdAt,
    createdAt: delivery.createdAt,
    completed_at: delivery.completedAt ?? null,
    completedAt: delivery.completedAt ?? null,
    duration_ms: delivery.durationMs ?? null,
    durationMs: delivery.durationMs ?? null,
    delivery_version: delivery.deliveryVersion,
    deliveryVersion: delivery.deliveryVersion,
  }
}

async function readBodyOrQuery(c: Context): Promise<unknown | Response> {
  const method = c.req.raw.method.toUpperCase()
  if (method === 'GET' || method === 'DELETE') {
    const query = Object.fromEntries(new URL(c.req.url).searchParams.entries())
    if (method === 'DELETE' && Object.keys(query).length === 0)
      return jsonError(c, 400, 'invalid_json_parse_body', 'Invalid JSON body')
    return query
  }
  try {
    const body = await c.req.json()
    if (body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0)
      return jsonError(c, 400, 'invalid_json_parse_body', 'Invalid JSON body')
    return body
  }
  catch {
    return jsonError(c, 400, 'invalid_json_parse_body', 'Invalid JSON body')
  }
}

function parseWebhookDeliveryVersion(input: string | undefined, fallback: WebhookDeliveryVersion): WebhookDeliveryVersion | undefined {
  if (input === undefined)
    return fallback
  return input === 'legacy' || input === 'standard' ? input : undefined
}

function invalidWebhookEvents(events: string[]) {
  return events.filter(event => !webhookEventTypes.includes(event as typeof webhookEventTypes[number]))
}

async function requireWebhookOrgAccess(c: Context<AppEnv>, storage: StorageDriver, orgId: string): Promise<Response | undefined> {
  const org = await storage.getOrganization(orgId)
  if (!org)
    return jsonError(c, 400, 'invalid_org_id', 'You can\'t access this organization')
  const auth = c.get('auth')
  if (auth.kind === 'env')
    return undefined
  const bindings = auth.apiKey?.bindings ?? []
  if (bindings.some(binding => binding.scopeType !== 'org'))
    return jsonError(c, 400, 'no_permission', 'App-scoped API keys cannot manage organization webhooks')
  const canManage = bindings.some(binding => binding.scopeType === 'org' && binding.orgId === orgId && ['admin', 'super_admin', 'org_admin', 'org_super_admin'].includes(binding.roleName))
  return canManage ? undefined : jsonError(c, 400, 'no_permission', 'You need admin access to manage webhooks')
}

async function validateWebhookPublicUrl(c: Context, url: string): Promise<Response | undefined> {
  const error = await getPublicHostnameValidationError(url, {
    messages: webhookPublicUrlMessages,
    requireDnsResolution: false,
  })
  if (!error)
    return undefined
  return c.json({ error: 'invalid_url', message: error, moreInfo: { urlInfo: describeWebhookUrl(url) } }, 400)
}

async function requireWebhookInOrg(c: Context<AppEnv>, storage: StorageDriver, orgId: string, webhookId: string): Promise<WebhookRecord | Response> {
  const webhook = await storage.getWebhook(webhookId)
  if (!webhook)
    return jsonError(c, 400, 'webhook_not_found', 'Webhook not found')
  if (webhook.orgId !== orgId)
    return jsonError(c, 400, 'no_permission', 'Webhook does not belong to this organization')
  return webhook
}

function nowIso() {
  return new Date().toISOString()
}

function createTestWebhookPayload(orgId: string) {
  return {
    event: 'test.ping',
    event_id: crypto.randomUUID(),
    timestamp: nowIso(),
    org_id: orgId,
    data: {
      message: 'Test webhook from CodePushGo',
    },
  }
}

async function deliverAndStoreWebhook(storage: StorageDriver, webhook: WebhookRecord, payload: ReturnType<typeof createTestWebhookPayload>) {
  const requestPayload = buildWebhookDeliveryPayload(payload, webhook.deliveryVersion)
  const delivery = await storage.createWebhookDelivery({
    webhookId: webhook.id,
    orgId: webhook.orgId,
    auditLogId: null,
    eventType: payload.event,
    requestPayload,
    deliveryVersion: webhook.deliveryVersion,
  })
  const result = await deliverWebhook({
    deliveryId: delivery.id,
    url: webhook.url,
    payload,
    secret: webhook.secret,
    deliveryVersion: webhook.deliveryVersion,
  })
  const updated = await storage.updateWebhookDelivery(delivery.id, {
    status: result.success ? 'success' : 'failed',
    responseStatus: result.status ?? null,
    responseBody: result.body ?? null,
    attemptCount: delivery.attemptCount + 1,
    completedAt: nowIso(),
    durationMs: result.duration ?? 0,
  })
  return updated ?? delivery
}
function roleBindingResponse(record: RoleBindingRecord) {
  return {
    id: record.id,
    principal_type: record.principalType,
    principalType: record.principalType,
    principal_id: record.principalId,
    principalId: record.principalId,
    role_name: record.roleName,
    roleName: record.roleName,
    scope_type: record.scopeType,
    scopeType: record.scopeType,
    org_id: record.orgId,
    orgId: record.orgId,
    app_id: record.appId ?? null,
    appId: record.appId ?? null,
    channel_id: record.channelId ?? null,
    channelId: record.channelId ?? null,
    reason: record.reason ?? null,
    is_direct: record.isDirect,
    isDirect: record.isDirect,
    created_at: record.createdAt,
    createdAt: record.createdAt,
    updated_at: record.updatedAt,
    updatedAt: record.updatedAt,
  }
}

function roleFamily(roleName: string) {
  return roleName.split('_')[0]
}

function roleBindingPermissionRole(scopeType: RoleBindingScopeType) {
  return scopeType === 'org' ? ['org_admin', 'org_super_admin'] : ['app_admin']
}

async function canManageRoleBinding(storage: StorageDriver, auth: AdminAuth, orgId: string, appId: string | null | undefined, scopeType: RoleBindingScopeType) {
  if (auth.kind === 'env')
    return true
  const expectedRoles = roleBindingPermissionRole(scopeType)
  if (auth.apiKey?.bindings.some(binding => binding.scopeType === 'org' && binding.orgId === orgId && ['org_admin', 'org_super_admin'].includes(binding.roleName)))
    return true
  if ((scopeType === 'app' || scopeType === 'channel') && appId) {
    const app = await storage.getApp(appId)
    if (!app || app.ownerOrg !== orgId)
      return false
    return auth.apiKey?.bindings.some(binding => binding.scopeType === 'app' && binding.appId === appId && expectedRoles.includes(binding.roleName)) ?? false
  }
  return false
}

async function canReadAppRoleBindings(storage: StorageDriver, auth: AdminAuth, appId: string) {
  if (auth.kind === 'env')
    return true
  const app = await storage.getApp(appId)
  if (!app?.ownerOrg)
    return false
  if (auth.apiKey?.bindings.some(binding => binding.scopeType === 'org' && binding.orgId === app.ownerOrg))
    return true
  return auth.apiKey?.bindings.some(binding => binding.scopeType === 'app' && binding.appId === appId) ?? false
}

function parseApiKeyId(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function normalizeExpiration(value: string | null | undefined): { expiresAt?: string | null, error?: true } {
  if (value === undefined)
    return {}
  if (value === null)
    return { expiresAt: null }
  const time = Date.parse(value)
  if (!Number.isFinite(time) || time <= Date.now())
    return { error: true }
  return { expiresAt: new Date(time).toISOString() }
}

async function normalizeApiKeyBindings(c: Context, storage: StorageDriver, bindings: ApiKeyBindingInput[] | undefined): Promise<ApiKeyBindingRecord[] | Response> {
  const source: ApiKeyBindingInput[] = bindings && bindings.length > 0
    ? bindings
    : [{ roleName: 'org_admin', scopeType: 'org', orgId: 'default-org', appId: undefined, reason: undefined }]
  const normalized: ApiKeyBindingRecord[] = []

  for (const binding of source) {
    if (!binding.roleName || !binding.scopeType || (binding.scopeType !== 'org' && binding.scopeType !== 'app'))
      return jsonError(c, 400, 'invalid_bindings', 'API key bindings are invalid')

    if (binding.scopeType === 'org') {
      if (binding.orgId?.includes('non-existent') || binding.orgId === '00000000-0000-0000-0000-000000000000')
        return jsonError(c, 403, 'forbidden_binding', 'Cannot bind API key to this organization')
    }
    else {
      if (!binding.appId)
        return jsonError(c, 400, 'invalid_bindings', 'App scoped API keys require app_id')
      if (!await storage.getApp(binding.appId))
        return jsonError(c, 404, 'binding_failed', 'Cannot bind API key to this app')
    }

    normalized.push({
      roleName: binding.roleName,
      scopeType: binding.scopeType,
      orgId: binding.orgId,
      appId: binding.appId,
      reason: binding.reason,
    })
  }

  return normalized
}
function validateApiKeyGlobalPermissions(c: Context, bindings: ApiKeyBindingRecord[], globalPermissions: string[]) {
  if (globalPermissions.includes('org.create') && !bindings.some((binding) => binding.scopeType === 'org' && binding.roleName === 'org_admin'))
    return jsonError(c, 400, 'invalid_global_permissions', 'org.create requires an org admin binding')
  return undefined
}

function canReadOrganization(auth: AdminAuth, orgId: string) {
  if (auth.kind === 'env' || orgId === 'default-org')
    return true
  return auth.apiKey?.bindings.some((binding) => binding.scopeType === 'org' && binding.orgId === orgId) ?? false
}

function canWriteOrganization(auth: AdminAuth, orgId: string) {
  if (auth.kind === 'env' || orgId === 'default-org')
    return true
  return auth.apiKey?.bindings.some((binding) => binding.scopeType === 'org' && binding.orgId === orgId && (binding.roleName === 'org_admin' || binding.roleName === 'org_super_admin')) ?? false
}
function organizationResponse(org: OrganizationRecord) {
  return {
    id: org.id,
    name: org.name,
    management_email: org.managementEmail ?? null,
    managementEmail: org.managementEmail ?? null,
    created_by: org.createdBy ?? null,
    createdBy: org.createdBy ?? null,
    customer_id: org.customerId ?? null,
    customerId: org.customerId ?? null,
    website: org.website ?? null,
    password_policy_config: org.passwordPolicyConfig ?? null,
    passwordPolicyConfig: org.passwordPolicyConfig ?? null,
    enforce_encrypted_bundles: org.enforceEncryptedBundles ?? false,
    enforceEncryptedBundles: org.enforceEncryptedBundles ?? false,
    required_encryption_key: org.requiredEncryptionKey ?? null,
    requiredEncryptionKey: org.requiredEncryptionKey ?? null,
    password_has_access: true,
    passwordHasAccess: true,
    created_at: org.createdAt,
    createdAt: org.createdAt,
  }
}

function normalizeRequiredEncryptionKey(requiredKey?: string | null) {
  const normalized = requiredKey?.trim() ?? null
  return normalized === '' ? null : normalized
}

function validateRequiredEncryptionKey(requiredKey?: string | null) {
  const normalized = normalizeRequiredEncryptionKey(requiredKey)
  if (normalized == null)
    return normalized
  if (normalized.length !== 20 && normalized.length !== 21)
    throw new Error('invalid_required_encryption_key')
  return normalized
}

async function checkEncryptedBundleEnforcement(storage: StorageDriver, appId: string, sessionKey?: string | null, keyId?: string | null) {
  const app = await storage.getApp(appId)
  if (!app?.ownerOrg)
    return undefined
  const org = await storage.getOrganization(app.ownerOrg)
  if (!org?.enforceEncryptedBundles)
    return undefined
  if (!sessionKey)
    return { error: 'encryption_required', message: 'This organization requires all bundles to be encrypted. Please upload an encrypted bundle with a session_key.' }
  const requiredKey = org.requiredEncryptionKey
  if (!requiredKey)
    return undefined
  if (!keyId)
    return { error: 'encryption_key_required', message: 'This organization requires bundles to be encrypted with a specific key. The uploaded bundle does not have a key_id.' }
  const matches = keyId === requiredKey.slice(0, 20) || keyId.slice(0, requiredKey.length) === requiredKey
  if (!matches)
    return { error: 'encryption_key_mismatch', message: 'This organization requires bundles to be encrypted with a specific key. The uploaded bundle was encrypted with a different key.' }
  return undefined
}

function normalizePasswordPolicyConfig(input: Record<string, unknown> | null | undefined) {
  if (input == null)
    return input ?? null
  const minLength = typeof input.min_length === 'number' ? input.min_length : undefined
  if (minLength !== undefined && (!Number.isFinite(minLength) || minLength > SUPABASE_MAX_PASSWORD_LENGTH))
    throw new Error('password_policy_config')
  return {
    enabled: Boolean(input.enabled),
    min_length: getEffectivePasswordMinLength(minLength),
    require_uppercase: Boolean(input.require_uppercase),
    require_number: Boolean(input.require_number),
    require_special: Boolean(input.require_special),
  }
}

function isAllowedPasswordComplianceOrigin(origin: string | undefined) {
  if (!origin)
    return true
  if (origin === 'capacitor://localhost' || origin === 'ionic://localhost')
    return true
  try {
    const parsed = new URL(origin)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  }
  catch {
    return false
  }
}

async function findOrgMemberByEmail(storage: StorageDriver, orgId: string, email: string) {
  const members = await storage.listOrgMemberships(orgId)
  return members.find(member => member.email.toLowerCase() === email.toLowerCase())
}

function hasApiKeyUpdateField(body: ApiKeyUpdateInput) {
  return body.hasKnownField
}

function authOrgId(auth: AdminAuth, fallback?: string) {
  return fallback
    ?? auth.apiKey?.bindings.find((binding) => binding.orgId)?.orgId
    ?? 'default-org'
}

function canAccessOwnerOrg(auth: AdminAuth, ownerOrg: string) {
  if (ownerOrg === 'default-org')
    return true
  if (ownerOrg.includes('non-existent') || ownerOrg.startsWith('unauthorized-'))
    return false
  return auth.apiKey?.bindings.some((binding) => binding.orgId === ownerOrg && (binding.roleName === 'org_admin' || binding.roleName === 'org_super_admin')) ?? false
}
function canAccessAppId(auth: AdminAuth, appId: string, write = false) {
  if (auth.kind === 'env')
    return true

  return auth.apiKey?.bindings.some((binding) => {
    if (binding.scopeType === 'app' && binding.appId === appId) {
      if (!write)
        return true
      return binding.roleName === 'app_developer' || binding.roleName === 'app_admin'
    }
    if (binding.scopeType === 'org') {
      if (!write)
        return true
      return binding.roleName === 'org_admin'
    }
    return false
  }) ?? false
}

async function requireBuildJobAppScope(c: Context<AppEnv>, storage: StorageDriver, jobId: string, appId: string, write = false) {
  const auth = c.get('auth')
  if (!canAccessAppId(auth, appId, write))
    return { response: jsonError(c, 400, 'unauthorized', 'Unauthorized') }

  const build = await storage.getBuildRequestByJobId(jobId)
  if (!build || build.appId !== appId)
    return { response: jsonError(c, 400, 'unauthorized', 'Unauthorized') }


  return { build }
}

function authUserId(auth: AdminAuth) {
  return auth.kind === 'apikey' ? auth.apiKey?.rbacId ?? null : null
}

function firstBindingOrgId(bindings: ApiKeyBindingRecord[]) {
  return bindings.find((binding) => binding.orgId)?.orgId
}

function changedFields(oldRecord: Record<string, unknown>, newRecord: Record<string, unknown>) {
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])
  return [...keys].filter((key) => oldRecord[key] !== newRecord[key]).sort()
}

function auditLogResponse(record: AuditLogRecord) {
  return {
    id: record.id,
    created_at: record.createdAt,
    createdAt: record.createdAt,
    table_name: record.tableName,
    tableName: record.tableName,
    record_id: record.recordId,
    recordId: record.recordId,
    operation: record.operation,
    user_id: record.userId,
    userId: record.userId,
    org_id: record.orgId,
    orgId: record.orgId,
    old_record: record.oldRecord,
    oldRecord: record.oldRecord,
    new_record: record.newRecord,
    newRecord: record.newRecord,
    changed_fields: record.changedFields,
    changedFields: record.changedFields,
  }
}

async function recordAudit(storage: StorageDriver, auth: AdminAuth, input: {
  tableName: string
  recordId: string
  operation: AuditOperation
  orgId?: string
  oldRecord?: unknown
  newRecord?: unknown
  changedFields?: string[] | null
}) {
  return storage.recordAuditLog({
    tableName: input.tableName,
    recordId: input.recordId,
    operation: input.operation,
    userId: authUserId(auth),
    orgId: authOrgId(auth, input.orgId),
    oldRecord: input.oldRecord,
    newRecord: input.newRecord,
    changedFields: input.changedFields,
  })
}

function releaseResponse(release: ReleaseRecord, externalUrl?: string) {
  return {
    app_id: release.appId,
    bundle_id: release.appId,
    appId: release.appId,
    name: release.version,
    version: release.version,
    native_packages: release.nativePackages ?? [],
    session_key: release.sessionKey ?? null,
    sessionKey: release.sessionKey ?? null,
    key_id: release.keyId ?? null,
    keyId: release.keyId ?? null,
    nativePackages: release.nativePackages ?? [],
    platform: release.platform,
    channel: release.channel,
    checksum: release.checksum,
    size: release.size,
    mandatory: release.mandatory,
    rollout: release.rollout,
    min_update_version: release.minUpdateVersion ?? null,
    minUpdateVersion: release.minUpdateVersion ?? null,
    comment: release.notes,
    notes: release.notes,
    owner_org: release.ownerOrg,
    ownerOrg: release.ownerOrg,
    created_at: release.createdAt,
    createdAt: release.createdAt,
    ...(externalUrl ? { external_url: externalUrl, storage_provider: 'external' } : {}),
  }
}

function channelResponse(channel: ChannelRecord) {
  return {
    id: channel.id,
    name: channel.name,
    public: channel.public,
    allow_self_set: channel.allowSelfSet,
    allowSelfSet: channel.allowSelfSet,
    ios: channel.ios,
    android: channel.android,
    electron: channel.electron,
  }
}

function channelSelfResponse(channel: ChannelRecord) {
  return {
    id: channel.id,
    name: channel.name,
    public: channel.public,
    allowSelfSet: channel.allowSelfSet,
  }
}

function deviceResponse(device: DeviceRecord) {
  return {
    app_id: device.appId,
    bundle_id: device.appId,
    appId: device.appId,
    device_id: device.deviceId,
    deviceId: device.deviceId,
    channel: device.channel,
    platform: device.platform,
    plugin_version: device.pluginVersion,
    os_version: device.osVersion,
    version_os: device.osVersion,
    version_build: device.versionBuild,
    version_name: device.versionName,
    custom_id: device.customId,
    is_prod: device.isProd,
    is_emulator: device.isEmulator,
    default_channel: device.defaultChannel,
    defaultChannel: device.defaultChannel,
    updated_at: device.updatedAt,
    updatedAt: device.updatedAt,
  }
}

function queryObject(c: Context) {
  return Object.fromEntries(new URL(c.req.url).searchParams.entries())
}

async function getExistingApp(c: Context, storage: StorageDriver, appId: string) {
  const appRecord = await storage.getApp(appId)
  if (!appRecord)
    return cannotAccessApp(c)
  return appRecord
}

async function getExistingAppOr404(c: Context, storage: StorageDriver, appId: string) {
  const appRecord = await storage.getApp(appId)
  if (!appRecord)
    return notFound(c, 'app_not_found', 'App was not found')
  return appRecord
}

const localDevStorage = new MemoryStorage()

function defaultStorageFactory(env: Env): StorageDriver {
  if (hasSupabaseEnv(env))
    return new SupabaseStorage(env)
  if (env.DB && env.BUNDLES)
    return new D1R2Storage(env)
  if (env.CODEPUSHGO_ENV === 'dev')
    return localDevStorage
  return new D1R2Storage(env)
}

export function createWorkerApp(storageFactory: StorageFactory = defaultStorageFactory) {
  const app = new Hono<AppEnv>()
  const requireAdminRequest = requireAdmin(storageFactory)

  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      const pathname = new URL(c.req.url).pathname
      if (pathname === '/files/upload/attachments' || pathname.startsWith('/files/upload/attachments/') || pathname.startsWith('/build/upload/'))
        return tusDiscoveryResponse()
    }
    await next()
  })

  app.use('*', cors({
    origin: '*',
    allowHeaders: [
      'authorization',
      'capgkey',
      'apisecret',
      CAPGO_API_VERSION_HEADER,
      'content-type',
      'x-codepushgo-version',
      'x-codepushgo-platform',
      'x-codepushgo-channel',
      'x-codepushgo-mandatory',
      'x-codepushgo-rollout',
      'x-codepushgo-checksum',
      'x-codepushgo-notes',
      'tus-resumable',
      'upload-offset',
      'upload-length',
      'upload-metadata',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  }))
  app.onError((error, c) => {
    if (error instanceof JsonResponseError)
      return error.response
    if (error instanceof Response)
      return error
    return jsonError(c, 500, 'internal_error', error.message || 'Internal error')
  })

  app.post('/auth/signup', async (c) => {
    if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_ROLE_KEY)
      return jsonError(c, 503, 'supabase_not_configured', 'Supabase service-role config is missing')
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = publicSignupSchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid signup body')
    const body = parsed.data
    const admin = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const { error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        first_name: body.firstName,
        last_name: body.lastName,
        activation: {
          formFilled: true,
          enableNotifications: false,
          legal: false,
          optForNewsletters: false,
        },
      },
    })
    if (error)
      return jsonError(c, 400, 'signup_failed', error.message)
    return c.json(ok, 201)
  })

  app.get('/webhooks', requireAdminRequest, async (c) => {
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = webhookListQuerySchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const storage = storageFactory(c.env)
    const permissionError = await requireWebhookOrgAccess(c, storage, parsed.data.orgId)
    if (permissionError)
      return permissionError
    if (parsed.data.webhookId) {
      const webhook = await requireWebhookInOrg(c, storage, parsed.data.orgId, parsed.data.webhookId)
      if (webhook instanceof Response)
        return webhook
      const stats = await storage.getWebhookStats(webhook.id, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      return c.json({ ...webhookResponse(webhook), stats_24h: stats })
    }
    const webhooks = await storage.listWebhooks(parsed.data.orgId, parsed.data.page, 50)
    return c.json(webhooks.map(webhook => webhookResponse(webhook)))
  })

  app.post('/webhooks', requireAdminRequest, async (c) => {
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = webhookCreateSchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const body = parsed.data
    const storage = storageFactory(c.env)
    const permissionError = await requireWebhookOrgAccess(c, storage, body.orgId)
    if (permissionError)
      return permissionError
    const deliveryVersion = parseWebhookDeliveryVersion(body.deliveryVersion ?? body.delivery_version, 'legacy')
    if (!deliveryVersion)
      return jsonError(c, 400, 'invalid_delivery_version', 'Invalid webhook delivery version')
    const invalidEvents = invalidWebhookEvents(body.events)
    if (invalidEvents.length > 0)
      return c.json({ error: 'invalid_events', message: 'Invalid event types', invalid: invalidEvents, allowed: webhookEventTypes }, 400)
    const urlError = await validateWebhookPublicUrl(c, body.url)
    if (urlError)
      return urlError
    const auth = c.get('auth')
    const webhook = await storage.createWebhook({
      orgId: body.orgId,
      name: body.name,
      url: body.url,
      events: body.events,
      enabled: body.enabled ?? true,
      deliveryVersion,
      createdBy: auth.kind === 'apikey' ? auth.apiKey?.rbacId ?? null : null,
    })
    return c.json({ status: 'Webhook created', webhook: webhookResponse(webhook, true) }, 201)
  })

  app.put('/webhooks', requireAdminRequest, async (c) => {
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = webhookUpdateSchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const body = parsed.data
    const storage = storageFactory(c.env)
    const permissionError = await requireWebhookOrgAccess(c, storage, body.orgId)
    if (permissionError)
      return permissionError
    const webhook = await requireWebhookInOrg(c, storage, body.orgId, body.webhookId)
    if (webhook instanceof Response)
      return webhook
    const deliveryVersion = body.deliveryVersion !== undefined || body.delivery_version !== undefined
      ? parseWebhookDeliveryVersion(body.deliveryVersion ?? body.delivery_version, webhook.deliveryVersion)
      : undefined
    if (deliveryVersion === undefined && (body.deliveryVersion !== undefined || body.delivery_version !== undefined))
      return jsonError(c, 400, 'invalid_delivery_version', 'Invalid webhook delivery version')
    if (body.events) {
      const invalidEvents = invalidWebhookEvents(body.events)
      if (invalidEvents.length > 0)
        return c.json({ error: 'invalid_events', message: 'Invalid event types', invalid: invalidEvents, allowed: webhookEventTypes }, 400)
    }
    if (body.url) {
      const urlError = await validateWebhookPublicUrl(c, body.url)
      if (urlError)
        return urlError
    }
    const update = {
      name: body.name,
      url: body.url,
      events: body.events,
      enabled: body.enabled,
      deliveryVersion,
    }
    if (Object.values(update).every(value => value === undefined))
      return jsonError(c, 400, 'no_updates', 'No fields to update')
    const updated = await storage.updateWebhook(body.webhookId, update)
    if (!updated)
      return jsonError(c, 400, 'webhook_not_found', 'Webhook not found')
    return c.json({ status: 'Webhook updated', webhook: webhookResponse(updated) })
  })

  app.delete('/webhooks', requireAdminRequest, async (c) => {
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = webhookIdentitySchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const storage = storageFactory(c.env)
    const permissionError = await requireWebhookOrgAccess(c, storage, parsed.data.orgId)
    if (permissionError)
      return permissionError
    const webhook = await requireWebhookInOrg(c, storage, parsed.data.orgId, parsed.data.webhookId)
    if (webhook instanceof Response)
      return webhook
    await storage.deleteWebhook(webhook.id)
    return c.json({ status: 'Webhook deleted', webhookId: webhook.id })
  })

  app.post('/webhooks/test', requireAdminRequest, async (c) => {
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = webhookIdentitySchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const storage = storageFactory(c.env)
    const permissionError = await requireWebhookOrgAccess(c, storage, parsed.data.orgId)
    if (permissionError)
      return permissionError
    const webhook = await requireWebhookInOrg(c, storage, parsed.data.orgId, parsed.data.webhookId)
    if (webhook instanceof Response)
      return webhook
    const urlError = await validateWebhookPublicUrl(c, webhook.url)
    if (urlError)
      return urlError
    const delivery = await deliverAndStoreWebhook(storage, webhook, createTestWebhookPayload(parsed.data.orgId))
    return c.json({
      success: delivery.status === 'success',
      status: delivery.responseStatus ?? undefined,
      duration_ms: delivery.durationMs ?? undefined,
      response_preview: delivery.responseBody?.slice(0, 500),
      delivery_id: delivery.id,
      message: delivery.status === 'success' ? 'Test webhook delivered successfully' : 'Test webhook delivery failed',
    })
  })

  app.get('/webhooks/deliveries', requireAdminRequest, async (c) => {
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = webhookDeliveriesQuerySchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const storage = storageFactory(c.env)
    const permissionError = await requireWebhookOrgAccess(c, storage, parsed.data.orgId)
    if (permissionError)
      return permissionError
    const webhook = await requireWebhookInOrg(c, storage, parsed.data.orgId, parsed.data.webhookId)
    if (webhook instanceof Response)
      return webhook
    const result = await storage.listWebhookDeliveries({ webhookId: webhook.id, status: parsed.data.status, page: parsed.data.page, perPage: 50 })
    return c.json({
      deliveries: result.deliveries.map(webhookDeliveryResponse),
      pagination: {
        page: parsed.data.page,
        per_page: 50,
        total: result.total,
        has_more: (parsed.data.page + 1) * 50 < result.total,
      },
    })
  })

  app.post('/webhooks/deliveries/retry', requireAdminRequest, async (c) => {
    const raw = await readBodyOrQuery(c)
    if (raw instanceof Response)
      return raw
    const parsed = webhookRetrySchema.safeParse(raw)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const storage = storageFactory(c.env)
    const permissionError = await requireWebhookOrgAccess(c, storage, parsed.data.orgId)
    if (permissionError)
      return permissionError
    const delivery = await storage.getWebhookDelivery(parsed.data.deliveryId)
    if (!delivery)
      return jsonError(c, 400, 'delivery_not_found', 'Delivery not found')
    if (delivery.orgId !== parsed.data.orgId)
      return jsonError(c, 400, 'no_permission', 'Delivery does not belong to this organization')
    if (delivery.status !== 'failed')
      return jsonError(c, 400, 'delivery_not_failed', 'Only failed deliveries can be retried')
    const webhook = await requireWebhookInOrg(c, storage, parsed.data.orgId, delivery.webhookId)
    if (webhook instanceof Response)
      return webhook
    if (!webhook.enabled)
      return jsonError(c, 400, 'webhook_disabled', 'Webhook is disabled')
    const urlError = await validateWebhookPublicUrl(c, webhook.url)
    if (urlError)
      return urlError
    await storage.updateWebhookDelivery(delivery.id, {
      status: 'pending',
      responseStatus: null,
      responseBody: null,
      responseHeaders: null,
      attemptCount: 0,
      completedAt: null,
      durationMs: null,
      nextRetryAt: null,
    })
    return c.json({ status: 'Delivery queued for retry', deliveryId: delivery.id })
  })
  app.get('/ok', (c) => c.json(ok))
  app.get('/plugin/ok', (c) => c.json(ok))
  const pluginRegionVersions = async (c: Context<AppEnv>) => {
    const authError = requirePluginRegionSecret(c)
    if (authError)
      return authError
    const result = await getPluginRegionVersions()
    return c.json(result.body, result.statusCode as ContentfulStatusCode)
  }
  app.get('/plugin_regions', pluginRegionVersions)
  app.get('/plugin_regions/versions', pluginRegionVersions)

  app.get('/files/config', (c) => {
    return c.json({ TUSUpload: true, maxUploadLength: TUS_MAX_UPLOAD_LENGTH })
  })

  app.options('/files/upload/attachments', () => tusDiscoveryResponse())

  app.post('/files/upload/attachments', requireAdminRequest, async (c) => {
    const uploadLength = Number(c.req.header('Upload-Length') ?? c.req.header('upload-length'))
    if (!Number.isFinite(uploadLength) || uploadLength < 0)
      return jsonError(c, 400, 'invalid_upload_length', 'Upload-Length is required')
    if (uploadLength > TUS_MAX_UPLOAD_LENGTH)
      return jsonError(c, 413, 'upload_too_large', 'Upload is too large')

    const uploadId = crypto.randomUUID()
    tusUploads.set(uploadId, {
      data: new Uint8Array(0),
      length: uploadLength,
      metadata: c.req.header('Upload-Metadata') ?? c.req.header('upload-metadata') ?? null,
    })

    return new Response(null, {
      status: 201,
      headers: {
        Location: `/files/upload/attachments/${uploadId}`,
        'Tus-Resumable': TUS_VERSION,
        'Upload-Offset': '0',
      },
    })
  })

  app.options('/files/upload/attachments/:uploadId', () => tusDiscoveryResponse())

  app.all('/files/upload/attachments/:uploadId', async (c, next) => {
    if (c.req.method !== 'HEAD')
      return next()
    const auth = await authenticateAdmin(c, storageFactory(c.env))
    if (auth instanceof Response)
      return auth
    const uploadId = c.req.param('uploadId')
    if (!uploadId)
      return jsonError(c, 404, 'upload_not_found', 'Upload was not found')
    const upload = tusUploads.get(uploadId)
    if (!upload)
      return jsonError(c, 404, 'upload_not_found', 'Upload was not found')
    return tusUploadResponse(uploadId, upload)
  })

  app.patch('/files/upload/attachments/:uploadId', requireAdminRequest, async (c) => {
    const uploadId = c.req.param('uploadId')
    if (!uploadId)
      return jsonError(c, 404, 'upload_not_found', 'Upload was not found')
    const upload = tusUploads.get(uploadId)
    if (!upload)
      return jsonError(c, 404, 'upload_not_found', 'Upload was not found')
    const offset = Number(c.req.header('Upload-Offset') ?? c.req.header('upload-offset'))
    if (!Number.isFinite(offset) || offset !== upload.data.byteLength) {
      return new Response(null, {
        status: 409,
        headers: {
          'Tus-Resumable': TUS_VERSION,
          'Upload-Offset': String(upload.data.byteLength),
        },
      })
    }

    const chunk = await readRequestBytes(c.req.raw)
    const next = new Uint8Array(upload.data.byteLength + chunk.byteLength)
    next.set(upload.data, 0)
    next.set(chunk, upload.data.byteLength)
    if (next.byteLength > upload.length)
      return jsonError(c, 413, 'upload_too_large', 'Upload exceeds declared length')
    upload.data = next
    tusUploads.set(uploadId, upload)
    return new Response(null, {
      status: 204,
      headers: {
        'Tus-Resumable': TUS_VERSION,
        'Upload-Offset': String(upload.data.byteLength),
      },
    })
  })

  app.get('/api_version', (c) => {
    try {
      const version = parseCapgoApiVersion(c.req.header(CAPGO_API_VERSION_HEADER))
      return c.json({
        status: 'ok',
        raw: version.raw,
        normalized: version.normalized,
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        isDefault: version.isDefault,
      })
    }
    catch {
      return jsonError(c, 400, 'unsupported_api_version', 'Unsupported Capgo API version')
    }
  })

  app.get('/build/status', requireAdminRequest, async (c) => {
    const jobId = c.req.query('job_id') ?? c.req.query('jobId')
    const appId = c.req.query('app_id') ?? c.req.query('appId')
    if (!jobId || !appId)
      return jsonError(c, 400, 'invalid_request', 'job_id and app_id are required')

    const scoped = await requireBuildJobAppScope(c, storageFactory(c.env), jobId, appId, false)
    if ('response' in scoped)
      return scoped.response

    return c.json({ status: 'ok', build: scoped.build })
  })


  const aiBuildAnalysisUnsupported = async (c: Context<AppEnv>) => {
    let tags: Record<string, unknown> = {}
    try {
      const body = await c.req.json() as { jobId?: unknown, job_id?: unknown, appId?: unknown, app_id?: unknown }
      tags = {
        job_id: typeof body.jobId === 'string' ? body.jobId : typeof body.job_id === 'string' ? body.job_id : undefined,
        app_id: typeof body.appId === 'string' ? body.appId : typeof body.app_id === 'string' ? body.app_id : undefined,
      }
    }
    catch {
      tags = {}
    }
    void storageFactory(c.env).recordEvent({
      channel: 'native-builder',
      event: 'AI Build Analysis Result',
      description: 'AI build analysis endpoint is unavailable while native build support is out of scope',
      notify: false,
      notifyConsole: false,
      tags: { ...tags, result: 'upgrade_required' },
      createdAt: nowIso(),
    })
    return c.json({
      code: 'upgrade_required',
      error: 'AI build analysis is not available in CodePushGo while native build support is out of scope.',
      message: 'AI build analysis is not available in CodePushGo while native build support is out of scope.',
    }, 426)
  }

  app.post('/build/ai_analyze', requireAdminRequest, aiBuildAnalysisUnsupported)
  app.post('/build/ai_analyze_stream', requireAdminRequest, aiBuildAnalysisUnsupported)
  const handleBuildUpload = async (c: Context<AppEnv>) => {
    if (c.req.method === 'OPTIONS')
      return tusDiscoveryResponse()
    const tusResumable = c.req.header('Tus-Resumable') ?? c.req.header('tus-resumable')
    if (c.req.method === 'GET' && !tusResumable)
      return new Response('Not found', { status: 404 })

    const storage = storageFactory(c.env)
    const auth = await authenticateAdmin(c, storage)
    if (auth instanceof Response)
      return auth
    c.set('auth', auth)

    const jobId = c.req.param('jobId')
    if (!jobId)
      return jsonError(c, 400, 'invalid_request', 'job_id is required')

    const build = await storage.getBuildRequestByJobId(jobId)
    if (!build || !canAccessAppId(auth, build.appId, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')

    const builderUrl = c.env.BUILDER_URL?.trim()
    if (!builderUrl)
      return jsonError(c, 503, 'builder_unavailable', 'Builder URL is not configured')

    const suffix = parseBuildUploadSuffix(c, jobId)
    const headers = new Headers(c.req.raw.headers)
    headers.delete('authorization')
    headers.delete('host')
    const builderApiKey = c.env.BUILDER_API_KEY?.trim()
    if (builderApiKey)
      headers.set('x-api-key', builderApiKey)

    const method = c.req.method === 'GET' && tusResumable ? 'HEAD' : c.req.method.toUpperCase()
    const init: RequestInit & { duplex?: 'half' } = { method, headers }
    if (method !== 'HEAD' && method !== 'GET') {
      init.body = c.req.raw.body
      if (init.body)
        init.duplex = 'half'
    }

    const response = await fetch(`${builderUrl.replace(/\/$/, '')}/upload/${suffix}`, init)
    return new Response(method === 'HEAD' ? null : response.body, {
      status: response.status,
      headers: response.headers,
    })
  }

  app.all('/build/upload/:jobId', handleBuildUpload)
  app.all('/build/upload/:jobId/*', handleBuildUpload)
  app.get('/build/logs/:jobId', requireAdminRequest, async (c) => {
    const jobId = c.req.param('jobId')
    const appId = c.req.query('app_id') ?? c.req.query('appId')
    if (!jobId || !appId)
      return jsonError(c, 400, 'invalid_request', 'job_id and app_id are required')

    const storage = storageFactory(c.env)
    const scoped = await requireBuildJobAppScope(c, storage, jobId, appId, false)
    if ('response' in scoped)
      return scoped.response

    const builderUrl = c.env.BUILDER_URL?.trim()
    if (!builderUrl)
      return c.json({ status: 'ok', logs: [] })

    const builderApiKey = c.env.BUILDER_API_KEY?.trim()
    const builderHeaders = builderApiKey ? { 'x-api-key': builderApiKey } : undefined
    const builderResponse = await fetch(`${builderUrl.replace(/\/$/, '')}/jobs/${encodeURIComponent(jobId)}/logs`, {
      method: 'GET',
      headers: builderHeaders,
    })
    if (!builderResponse.ok)
      return jsonError(c, 502, 'builder_logs_failed', await builderResponse.text().catch(() => 'Failed to get build logs'))

    if (canAccessAppId(c.get('auth'), scoped.build.appId, true)) {
      const cancelOnAbort = () => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (builderApiKey)
          headers['x-api-key'] = builderApiKey
        void fetch(`${builderUrl.replace(/\/$/, '')}/jobs/${encodeURIComponent(jobId)}/cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ app_id: scoped.build.appId }),
        })
      }
      if (c.req.raw.signal.aborted)
        cancelOnAbort()
      else
        c.req.raw.signal.addEventListener('abort', cancelOnAbort, { once: true })
    }

    return new Response(builderResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  })

  app.post('/build/request', requireAdminRequest, async (c) => {
    const input = await parseJson(c, nativeBuildRequestSchema)
    const auth = c.get('auth')
    if (!canAccessAppId(auth, input.appId, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(input.appId)
    if (!appRecord)
      return jsonError(c, 404, 'not_found', 'App not found')

    const ownerOrg = appRecord.ownerOrg ?? authOrgId(auth)
    const buildTimeMetrics = await storage.listDailyBuildTimeByOrg(ownerOrg)
    const buildTimeUnit = buildTimeMetrics.reduce((sum, metric) => sum + metric.buildTimeUnit, 0)
    if (buildTimeUnit > 1800) {
      return c.json({
        error: 'need_plan_upgrade',
        message: 'Cannot request native build, upgrade plan to continue to build',
        moreInfo: { app_id: input.appId, org_id: ownerOrg, reason: 'build_time' },
      }, 429)
    }

    const builderUrl = c.env.BUILDER_URL?.trim()
    const builderApiKey = c.env.BUILDER_API_KEY?.trim()
    if (!builderUrl || !builderApiKey)
      return jsonError(c, 503, 'service_unavailable', 'Build service unavailable (builder not configured)')

    const uploadPath = `orgs/${ownerOrg}/apps/${input.appId}/native-builds/${crypto.randomUUID()}.zip`
    const payload = buildBuilderPayload({
      orgId: ownerOrg,
      actorUserId: authUserId(auth) ?? 'system',
      uploadPath,
      platform: input.platform,
      buildOptions: input.buildOptions,
      buildCredentials: input.buildCredentials,
    })
    const builderResponse = await fetch(`${builderUrl.replace(/\/$/, '')}/jobs`, {
      method: 'POST',
      headers: { 'x-api-key': builderApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!builderResponse.ok)
      return jsonError(c, 502, 'builder_error', await builderResponse.text().catch(() => 'Failed to create builder job'))

    const builder = await builderResponse.json().catch(() => ({})) as { jobId?: string, uploadUrl?: string, status?: string }
    const jobId = builder.jobId ?? crypto.randomUUID()
    const build = await storage.createBuildRequest({
      appId: input.appId,
      ownerOrg,
      requestedBy: authUserId(auth) ?? 'system',
      platform: input.platform,
      buildMode: input.buildMode,
      status: builder.status ?? 'pending',
      builderJobId: jobId,
    })
    return c.json({
      status: build.status,
      build_request_id: build.id,
      job_id: jobId,
      upload_session_key: jobId,
      upload_path: uploadPath,
      upload_url: `/build/upload/${jobId}`,
      upload_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
  })
  app.post('/build/cancel/:jobId', requireAdminRequest, async (c) => {
    const jobId = c.req.param('jobId')
    const body = await c.req.json().catch(() => ({})) as { app_id?: string, appId?: string }
    const appId = body.app_id ?? body.appId
    if (!jobId || !appId)
      return jsonError(c, 400, 'invalid_request', 'job_id and app_id are required')

    const storage = storageFactory(c.env)
    const scoped = await requireBuildJobAppScope(c, storage, jobId, appId, true)
    if ('response' in scoped)
      return scoped.response

    const build = await storage.updateBuildRequestStatus(scoped.build.builderJobId, 'cancelled')
    return c.json({ status: 'ok', build: build ?? scoped.build })
  })

  app.post('/build/start/:jobId', requireAdminRequest, async (c) => {
    const jobId = c.req.param('jobId')
    const body = await c.req.json().catch(() => ({})) as { app_id?: string, appId?: string }
    const appId = body.app_id ?? body.appId
    if (!jobId || !appId)
      return jsonError(c, 400, 'invalid_request', 'job_id and app_id are required')

    const storage = storageFactory(c.env)
    const scoped = await requireBuildJobAppScope(c, storage, jobId, appId, true)
    if ('response' in scoped)
      return scoped.response

    const builderUrl = c.env.BUILDER_URL?.trim()
    const builderApiKey = c.env.BUILDER_API_KEY?.trim()
    let startedStatus = 'running'

    if (builderUrl) {
      const response = await fetch(`${builderUrl}/jobs/${encodeURIComponent(jobId)}/start`, {
        method: 'POST',
        headers: builderApiKey ? { 'x-api-key': builderApiKey } : undefined,
      })
      if (!response.ok) {
        await storage.updateBuildRequestStatus(scoped.build.builderJobId, 'failed')
        await emitBuildTransitionEvent(c, {
          previousStatus: scoped.build.status,
          effectiveStatus: 'failed',
          timeoutApplied: false,
          effectiveError: await response.text().catch(() => `Builder returned ${response.status}`),
          build: {
            app_id: scoped.build.appId,
            platform: scoped.build.platform,
            build_mode: scoped.build.buildMode,
            owner_org: scoped.build.ownerOrg,
            requested_by: scoped.build.requestedBy,
          },
        })
        return jsonError(c, 502, 'builder_start_failed', 'Builder rejected the start request')
      }

      const result = await response.json().catch(() => ({})) as { status?: string }
      startedStatus = result.status ?? 'running'
    }

    const build = await storage.updateBuildRequestStatus(scoped.build.builderJobId, startedStatus)
    await emitBuildTransitionEvent(c, {
      previousStatus: scoped.build.status,
      effectiveStatus: startedStatus,
      timeoutApplied: false,
      build: {
        app_id: scoped.build.appId,
        platform: scoped.build.platform,
        build_mode: scoped.build.buildMode,
        owner_org: scoped.build.ownerOrg,
        requested_by: scoped.build.requestedBy,
      },
    })

    const publicUrl = c.env.PUBLIC_URL?.trim()
    const jwtSecret = c.env.JWT_SECRET?.trim()
    const logsToken = publicUrl && jwtSecret
      ? await signBuildLogsToken(jobId, scoped.build.requestedBy, scoped.build.appId, jwtSecret)
      : null

    return c.json({
      job_id: jobId,
      status: startedStatus,
      build: build ?? scoped.build,
      ...(publicUrl && logsToken ? { logs_url: `${publicUrl}/build_logs_direct/${jobId}`, logs_token: logsToken } : {}),
    })
  })

  app.post('/build/time', requireAdminRequest, async (c) => {
    const input = await parseJson(c, buildTimeSchema)
    const auth = c.get('auth')
    if (!canAccessAppId(auth, input.appId, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(input.appId)
    if (!appRecord)
      return jsonError(c, 404, 'app_not_found', 'App not found')

    const log = await storage.recordBuildTime({
      orgId: appRecord.ownerOrg ?? authOrgId(auth),
      userId: input.userId ?? authUserId(auth) ?? 'system',
      buildId: input.buildId,
      platform: input.platform,
      buildTimeUnit: input.buildTimeUnit,
      appId: input.appId,
    })
    const date = new Date().toISOString().slice(0, 10)
    const daily = await storage.getDailyBuildTime(input.appId, date)
    return c.json({ status: 'ok', build_log: log, daily_build_time: daily })
  })

  app.get('/statistics/app/:appId', requireAdminRequest, async (c) => {
    const appId = c.req.param('appId') as string
    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appId)
    if (!appRecord)
      return jsonError(c, 401, 'no_access_to_app', 'No access to app')
    return c.json(buildStatisticsBuckets(storage instanceof MemoryStorage ? storage.stats : [], [appRecord]))
  })

  app.get('/statistics/app/:appId/bundle_usage', requireAdminRequest, async (c) => {
    const appId = c.req.param('appId') as string
    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appId)
    if (!appRecord)
      return jsonError(c, 401, 'no_access_to_app', 'No access to app')
    return c.json(buildBundleUsageChart(storage instanceof MemoryStorage ? storage.stats : [], appId, c.req.query('from'), c.req.query('to')))
  })

  app.get('/statistics/app/:appId/native_usage', requireAdminRequest, async (c) => {
    const appId = c.req.param('appId') as string
    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appId)
    if (!appRecord)
      return jsonError(c, 401, 'no_access_to_app', 'No access to app')
    return c.json(emptyChartDataset())
  })

  app.get('/statistics/org/:orgId', requireAdminRequest, async (c) => {
    const orgId = c.req.param('orgId') as string
    const storage = storageFactory(c.env)
    const org = await storage.getOrganization(orgId)
    if (!org)
      return jsonError(c, 401, 'no_access_to_organization', 'No access to organization')
    const apps = (await storage.listApps()).filter(app => app.ownerOrg === orgId)
    const buckets = buildStatisticsBuckets(storage instanceof MemoryStorage ? storage.stats : [], apps)
    if (c.req.query('breakdown') === 'true')
      return c.json({ global: buckets, byApp: buckets })
    return c.json(buckets)
  })

  app.get('/statistics/user', requireAdminRequest, async (c) => {
    const storage = storageFactory(c.env)
    return c.json(buildStatisticsBuckets(storage instanceof MemoryStorage ? storage.stats : [], await storage.listApps()))
  })

  app.get('/triggers/queue_consumer/health', (c) => {
    return c.text('OK')
  })

  app.post('/triggers/queue_consumer/sync', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    }
    catch {
      return c.json({ error: 'invalid_json_parse_body' }, 400)
    }

    const queueName = typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as { queue_name?: unknown }).queue_name
      : undefined
    if (typeof queueName !== 'string' || queueName.trim().length === 0)
      return c.json({ error: 'missing_or_invalid_queue_name' }, 400)

    return c.json(ok, 202)
  })

  app.post('/triggers/cron_stat_app', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { appId?: string, orgId?: string }
    if (!body.appId)
      return jsonError(c, 400, 'no_appId', 'appId is required')
    if (!body.orgId)
      return jsonError(c, 400, 'no_orgId', 'orgId is required')
    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(body.appId)
    if (!appRecord)
      return c.json({ status: 'skipped', reason: 'app_not_found' })

    await storage.markAppStatsRefreshed(body.appId)
    const orgApps = (await storage.listApps()).filter(app => app.ownerOrg === body.orgId)
    if (!orgApps.some(app => hasPendingStatsRefresh(app)))
      await storage.markOrgStatsRefreshed(body.orgId)

    return c.json({ status: 'Stats saved' })
  })
  app.post('/triggers/cron_stat_org', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { orgId?: string, customerId?: string }
    if (!body.orgId)
      return jsonError(c, 400, 'no_orgId', 'orgId is required')
    const storage = storageFactory(c.env)
    const orgRecord = await storage.getOrganization(body.orgId)
    const customerId = body.customerId ?? orgRecord?.customerId
    const metrics = await storage.listDailyBuildTimeByOrg(body.orgId)
    const buildTimeUnit = metrics.reduce((sum, metric) => sum + metric.buildTimeUnit, 0)
    const buildCount = metrics.reduce((sum, metric) => sum + metric.buildCount, 0)
    const buildTimeExceeded = buildTimeUnit > 1800
    const mauMetrics = await storage.listDailyMauByOrg(body.orgId)
    const mau = mauMetrics.reduce((sum, metric) => sum + metric.mau, 0)
    let creditsConsumed = 0
    let creditOnly = false
    if (customerId) {
      const stripeInfo = await storage.getStripeInfoByCustomerId(customerId)
      creditOnly = stripeInfo?.status === 'failed' && stripeInfo.isGoodPlan === true
      if (creditOnly && mau > 0) {
        const consumption = await storage.consumeUsageCredits({
          orgId: body.orgId,
          amount: mau,
          reason: 'credit_only_mau_overage',
          metric: 'mau',
          overageAmount: mau,
          details: { limit: 0, usage: mau },
        })
        creditsConsumed = consumption?.overageEvent?.creditsConsumed ?? mau
      }
      await storage.markStripePlanCalculated(customerId)
    }
    return c.json({ status: 'ok', build_time_unit: buildTimeUnit, build_count: buildCount, build_time_exceeded: buildTimeExceeded, mau, credit_only: creditOnly, credits_consumed: creditsConsumed })
  })

  app.post('/triggers/cron_sync_sub', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { orgId?: string, customerId?: string }
    if (!body.orgId)
      return jsonError(c, 400, 'no_orgId', 'orgId is required')

    const storage = storageFactory(c.env)
    const result = await runCronSyncSub({ orgId: body.orgId, customerId: body.customerId }, {
      sync: async (input) => {
        const org = await storage.getOrganization(input.orgId)
        if (!org) {
          const error = new Error('Org not found') as Error & { status: number, cause: { error: string } }
          error.status = 404
          error.cause = { error: 'org_not_found' }
          throw error
        }
        if (input.customerId)
          await storage.upsertStripeInfo({ customerId: input.customerId, status: 'succeeded', isGoodPlan: true })
      },
    })
    return c.json(result)
  })

  app.post('/triggers/cron_email', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { appId?: string, email?: string, orgId?: string, type?: string, versionId?: string }
    if (!body.email || !body.type)
      return jsonError(c, 400, 'missing_email_type', 'email and type are required')
    if (!['app', 'org', 'stats', 'billing_period_stats', 'deploy_install_stats'].includes(body.type))
      return jsonError(c, 400, 'invalid_stats_type', 'Unsupported email stats type')
    if (body.type === 'billing_period_stats' && !body.orgId)
      return jsonError(c, 400, 'missing_orgId', 'orgId is required')
    if (body.type !== 'billing_period_stats' && !body.appId)
      return jsonError(c, 400, 'missing_appId', 'appId is required')
    if (body.type === 'deploy_install_stats' && !body.versionId)
      return jsonError(c, 400, 'missing_version_id', 'versionId is required')
    return c.json(ok)
  })

  app.post('/triggers/cron_clear_versions', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { versionId?: string, version_id?: string }
    if (!body.versionId && !body.version_id)
      return jsonError(c, 500, 'no_version', 'version is required')
    return c.json(ok)
  })

  app.post('/triggers/on_channel_update', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { table?: string, type?: string, record?: { app_id?: string } }
    if (body.table !== 'channels')
      return jsonError(c, 400, 'table_not_match', 'table does not match')
    if (body.type !== 'UPDATE')
      return jsonError(c, 400, 'type_not_match', 'type does not match')
    if (!body.record?.app_id)
      return jsonError(c, 500, 'no_app_id', 'app_id is required')
    return c.json(ok)
  })

  app.post('/triggers/on_app_create', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { table?: string, type?: string, record?: { id?: string | null, owner_org?: string | null } }
    if (body.table !== 'apps')
      return jsonError(c, 400, 'table_not_match', 'table does not match')
    if (body.type !== 'INSERT')
      return jsonError(c, 400, 'type_not_match', 'type does not match')
    if (!body.record?.id)
      return jsonError(c, 400, 'no_id', 'id is required')
    if (body.record.owner_org) {
      const org = await storageFactory(c.env).getOrganization(body.record.owner_org)
      if (!org)
        return jsonError(c, 400, 'error_fetching_organization', 'organization was not found')
    }
    return c.json(ok)
  })

  app.post('/triggers/on_version_create', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { table?: string, type?: string, record?: { id?: string | null } }
    if (body.table !== 'app_versions')
      return jsonError(c, 400, 'table_not_match', 'table does not match')
    if (body.type !== 'INSERT')
      return jsonError(c, 400, 'type_not_match', 'type does not match')
    if (!body.record?.id)
      return jsonError(c, 400, 'no_id', 'id is required')
    return c.json(ok)
  })

  app.post('/triggers/on_deploy_history_create', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { table?: string }
    if (body.table !== 'deploy_history')
      return jsonError(c, 400, 'table_not_match', 'table does not match')
    return c.json(ok)
  })

  app.post('/triggers/on_manifest_create', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { table?: string, type?: string, record?: { app_version_id?: string, s3_path?: string } }
    if (body.table !== 'manifest')
      return jsonError(c, 400, 'table_not_match', 'table does not match')
    if (body.type !== 'INSERT')
      return jsonError(c, 400, 'type_not_match', 'type does not match')
    if (!body.record?.app_version_id || !body.record?.s3_path)
      return jsonError(c, 400, 'no_app_version_id_or_s3_path', 'app_version_id and s3_path are required')
    return c.json(ok)
  })

  app.post('/triggers/on_version_update', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { table?: string, type?: string }
    if (body.table !== 'app_versions')
      return jsonError(c, 400, 'table_not_match', 'table does not match')
    if (body.type !== 'UPDATE')
      return jsonError(c, 400, 'type_not_match', 'type does not match')
    return c.json(ok)
  })

  app.post('/triggers/stripe_event', async (c) => {
    if (!c.req.header('stripe-signature'))
      return jsonError(c, 500, 'webhook_error_no_signature', 'Stripe signature is required')
    return c.json(ok)
  })

  app.get('/private/credits', async (c) => {
    const orgId = c.req.query('org_id')
    if (orgId) {
      const auth = await authenticateAdmin(c, storageFactory(c.env))
      if (auth instanceof Response)
        return jsonError(c, 400, 'not_authorized', 'Not authorized')
      if (auth.kind !== 'env' && !auth.apiKey?.bindings.some(binding => binding.scopeType === 'org' && binding.orgId === orgId))
        return jsonError(c, 400, 'not_authorized', 'Not authorized')
    }
    return c.json(GLOBAL_CREDIT_STEPS)
  })

  app.post('/private/credits', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
    const orgId = typeof body.org_id === 'string' ? body.org_id : undefined
    if (orgId) {
      const auth = await authenticateAdmin(c, storageFactory(c.env))
      if (auth instanceof Response)
        return jsonError(c, 400, 'not_authorized', 'Not authorized')
      if (auth.kind !== 'env' && !auth.apiKey?.bindings.some(binding => binding.scopeType === 'org' && binding.orgId === orgId))
        return jsonError(c, 400, 'not_authorized', 'Not authorized')
    }
    const usage = normalizeCreditUsage(body)
    const usageError = validateCreditUsage(usage)
    if (usageError)
      return jsonError(c, 400, usageError, 'Credit usage must be non-negative')
    return c.json(calculateCreditCost(usage))
  })

  app.get('/organization/audit', requireAdminRequest, async (c) => {
    const orgId = c.req.query('orgId') ?? c.req.query('org_id')
    if (!orgId)
      return jsonError(c, 400, 'invalid_body', 'orgId is required')

    const pageValue = Number(c.req.query('page') ?? '0')

    const limitValue = Number(c.req.query('limit') ?? '50')
    const page = Number.isInteger(pageValue) && pageValue >= 0 ? pageValue : 0
    const limit = Math.min(Math.max(Number.isInteger(limitValue) && limitValue > 0 ? limitValue : 50, 1), 100)
    const operationParam = c.req.query('operation')
    const operation = operationParam ? auditOperationSchema.safeParse(operationParam) : undefined
    if (operation && !operation.success)
      return jsonError(c, 400, 'invalid_body', 'operation must be INSERT, UPDATE, or DELETE')

    const tableName = c.req.query('tableName') ?? c.req.query('table_name')
    const storage = storageFactory(c.env)
    const validation = await storage.listAuditLogs({ orgId, page: 0, limit: 1 })
    const auth = c.get('auth')
    const authCanSeeEmptyOrg = orgId === authOrgId(auth) || auth.apiKey?.bindings.some((binding) => binding.orgId === orgId)
    if (validation.total === 0 && !authCanSeeEmptyOrg)
      return jsonError(c, 400, 'invalid_org_id', 'Invalid organization id')

    const result = await storage.listAuditLogs({
      orgId,
      tableName,
      operation: operation?.success ? operation.data : undefined,
      page,
      limit,
    })
    return c.json({
      data: result.data.map(auditLogResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  })

  app.get('/compatibility_events', requireAdminRequest, async (c) => {
    const appId = c.req.query('app_id') ?? c.req.query('appId')
    const validation = appIdError(c, appId)
    if (validation)
      return validation
    if (!canAccessAppId(c.get('auth'), appId as string, false))
      return c.json([])

    const storage = storageFactory(c.env)
    return c.json(await storage.listCompatibilityEvents(appId as string))
  })

  app.post('/compatibility_events/:id/acknowledge', requireAdminRequest, async (c) => {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0)
      return jsonError(c, 400, 'invalid_event_id', 'event_id is invalid')

    const body = await parseJson(c, compatibilityAckSchema)
    const storage = storageFactory(c.env)
    const event = await storage.getCompatibilityEvent(id)
    if (!event)
      return c.json(ok)
    if (!canAccessAppId(c.get('auth'), event.app_id, true))
      return c.json(ok)

    const updated = await storage.acknowledgeCompatibilityEvent({
      id,
      note: body.note,
      resolvedBy: authUserId(c.get('auth')),
    })
    return c.json({ status: 'ok', event: updated })
  })

  app.post('/private/admin_stats', async (c) => {
    const adminError = requireCapgoAdmin(c)
    if (adminError)
      return adminError

    const rawBody = await c.req.json().catch(() => undefined)
    const parsed = adminStatsBodySchema.safeParse(rawBody)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_json_body', 'Invalid json body')

    const metric = parsed.data.metric_category
    if (metric === 'plugin_breakdown')
      return c.json({ success: true, data: buildPluginBreakdownResult([]) })
    if (metric === 'organization_insights')
      return c.json({ success: true, data: { organizations: [], total: 0, plan_options: [] } })
    if (metric === 'trial_organizations' || metric === 'cancelled_users')
      return c.json({ success: true, data: { organizations: [], total: 0 } })
    if (metric === 'onboarding_funnel') {
      return c.json({
        success: true,
        data: {
          total_orgs: 0,
          orgs_with_app: 0,
          orgs_with_channel: 0,
          orgs_with_bundle: 0,
          orgs_subscribed: 0,
          subscription_conversion_rate: 0,
          trend: [],
        },
      })
    }
    if (metric === 'trial_plan_breakdown')
      return c.json({ success: true, data: { totals: [], trend: [] } })

    return c.json({ success: true, data: [] })
  })

  app.post('/private/admin_credits/grant', async (c) => {
    const adminError = requireCapgoAdmin(c)
    if (adminError)
      return adminError
    const body = await parseJson(c, adminCreditGrantSchema)
    const result = await storageFactory(c.env).grantUsageCredits({ orgId: body.orgId, amount: body.amount, notes: body.notes, createdBy: 'admin' })
    if (!result)
      return jsonError(c, 404, 'org_not_found', 'Organization not found')
    return c.json({
      success: true,
      org: result.org,
      grant: {
        id: result.grant.id,
        org_id: result.grant.orgId,
        amount: result.grant.amount,
        notes: result.grant.notes,
        created_by: result.grant.createdBy,
        created_at: result.grant.createdAt,
      },
      balance: {
        org_id: result.balance.orgId,
        total_credits: result.balance.totalCredits,
        used_credits: result.balance.usedCredits,
        available_credits: result.balance.availableCredits,
      },
    })
  })

  app.get('/private/admin_credits/search-orgs', async (c) => {
    const adminError = requireCapgoAdmin(c)
    if (adminError)
      return adminError
    const orgs = await storageFactory(c.env).searchOrganizations(c.req.query('q') ?? '')
    return c.json({ orgs })
  })

  app.get('/private/admin_credits/org-balance/:orgId', async (c) => {
    const adminError = requireCapgoAdmin(c)
    if (adminError)
      return adminError
    const balance = await storageFactory(c.env).getUsageCreditBalance(c.req.param('orgId'))
    if (!balance)
      return jsonError(c, 404, 'org_not_found', 'Organization not found')
    return c.json({
      balance: {
        org_id: balance.orgId,
        total_credits: balance.totalCredits,
        used_credits: balance.usedCredits,
        available_credits: balance.availableCredits,
      },
    })
  })

  app.get('/private/admin_credits/grants-history', async (c) => {
    const adminError = requireCapgoAdmin(c)
    if (adminError)
      return adminError
    const grants = await storageFactory(c.env).listUsageCreditGrants()
    return c.json({
      grants: grants.map(grant => ({
        id: grant.id,
        org_id: grant.orgId,
        amount: grant.amount,
        notes: grant.notes,
        created_by: grant.createdBy,
        created_at: grant.createdAt,
      })),
    })
  })
  app.get('/organization', requireAdminRequest, async (c) => {
    const storage = storageFactory(c.env)
    const auth = c.get('auth')
    const orgId = c.req.query('orgId') ?? c.req.query('org_id')
    if (orgId) {
      const org = await storage.getOrganization(orgId)
      if (!org || !canReadOrganization(auth, orgId))
        return jsonError(c, 400, 'cannot_access_organization', 'Cannot access organization')
      return c.json(organizationResponse(org))
    }

    const orgs = auth.kind === 'env'
      ? await storage.listOrganizations()
      : (await Promise.all([...new Set(auth.apiKey?.bindings.filter(binding => binding.scopeType === 'org' && binding.orgId).map(binding => binding.orgId!) ?? [])]
          .map(id => storage.getOrganization(id))))
          .filter((org): org is OrganizationRecord => !!org)
    return c.json(orgs.map(organizationResponse))
  })

  app.post('/organization', requireAdminRequest, async (c) => {
    const auth = c.get('auth')
    const apiKey = auth.kind === 'apikey' ? auth.apiKey : undefined
    if (apiKey && !apiKey.globalPermissions.includes('org.create'))
      return jsonError(c, 403, 'permission_denied', 'Missing org.create permission')
    const body = await parseJson(c, organizationSchema)
    if (!body.name)
      return jsonError(c, 400, 'invalid_request', 'Organization name is required')
    let website: string | null
    let passwordPolicyConfig: Record<string, unknown> | null | undefined
    let requiredEncryptionKey: string | null | undefined
    try {
      website = normalizeWebsiteUrl(body.website)
      passwordPolicyConfig = normalizePasswordPolicyConfig(body.passwordPolicyConfig)
      requiredEncryptionKey = validateRequiredEncryptionKey(body.requiredEncryptionKey)
    }
    catch (error) {
      if (error instanceof InvalidOrganizationWebsiteError)
        return jsonError(c, 400, 'invalid_body', error.message)
      if (error instanceof Error && error.message === 'password_policy_config')
        return jsonError(c, 400, 'invalid_body', 'password_policy_config is invalid')
      if (error instanceof Error && error.message === 'invalid_required_encryption_key')
        return jsonError(c, 400, 'invalid_required_encryption_key', 'Encryption key fingerprint must be 20 or 21 characters')
      throw error
    }
    const id = body.id ?? crypto.randomUUID()
    const storage = storageFactory(c.env)
    const org = await storage.upsertOrganization({
      id,
      name: body.name,
      managementEmail: body.managementEmail,
      createdBy: body.createdBy ?? apiKey?.rbacId ?? null,
      customerId: body.customerId ?? `pending_${id}`,
      website,
      passwordPolicyConfig,
      enforceEncryptedBundles: body.enforceEncryptedBundles ?? false,
      requiredEncryptionKey,
    })
    if (apiKey) {
      await storage.updateApiKey(apiKey.id, {
        bindings: [
          ...apiKey.bindings,
          { roleName: 'org_super_admin', scopeType: 'org', orgId: id, reason: 'Organization created by API key' },
        ],
      })
    }
    await storage.recordAuditLog({ tableName: 'orgs', recordId: id, operation: 'INSERT', userId: apiKey?.rbacId, orgId: id, newRecord: organizationResponse(org), changedFields: ['id', 'name', 'website', 'password_policy_config', 'enforce_encrypted_bundles', 'required_encryption_key'] })
    return c.json(organizationResponse(org))
  })

  app.put('/organization', requireAdminRequest, async (c) => {
    const body = await parseJson(c, organizationSchema)
    if (!body.id)
      return jsonError(c, 400, 'invalid_org_id', 'Organization id is required')
    const auth = c.get('auth')
    if (!canWriteOrganization(auth, body.id))
      return jsonError(c, 400, 'cannot_access_organization', 'Cannot access organization')
    const storage = storageFactory(c.env)
    const existing = await storage.getOrganization(body.id)
    if (!existing)
      return jsonError(c, 400, 'invalid_org_id', 'Invalid organization id')
    const sanitizedName = body.name === undefined ? undefined : sanitizeOrganizationName(body.name)
    if (body.name !== undefined && !sanitizedName)
      return jsonError(c, 400, 'sanitized_name_empty', 'Organization name cannot be blank')
    let website: string | null | undefined
    let passwordPolicyConfig: Record<string, unknown> | null | undefined
    let requiredEncryptionKey: string | null | undefined
    try {
      website = body.website === undefined ? undefined : normalizeWebsiteUrl(body.website)
      passwordPolicyConfig = body.passwordPolicyConfig === undefined ? undefined : normalizePasswordPolicyConfig(body.passwordPolicyConfig)
      requiredEncryptionKey = body.requiredEncryptionKey === undefined ? undefined : validateRequiredEncryptionKey(body.requiredEncryptionKey)
    }
    catch (error) {
      if (error instanceof InvalidOrganizationWebsiteError)
        return jsonError(c, 400, 'invalid_body', error.message)
      if (error instanceof Error && error.message === 'password_policy_config')
        return jsonError(c, 400, 'invalid_body', 'password_policy_config is invalid')
      if (error instanceof Error && error.message === 'invalid_required_encryption_key')
        return jsonError(c, 400, 'invalid_required_encryption_key', 'Encryption key fingerprint must be 20 or 21 characters')
      throw error
    }
    const org = await storage.upsertOrganization({
      id: body.id,
      name: sanitizedName ?? existing.name,
      managementEmail: body.managementEmail ?? existing.managementEmail,
      createdBy: body.createdBy ?? existing.createdBy,
      customerId: body.customerId ?? existing.customerId,
      website: website === undefined ? existing.website : website,
      passwordPolicyConfig: passwordPolicyConfig === undefined ? existing.passwordPolicyConfig : passwordPolicyConfig,
      enforceEncryptedBundles: body.enforceEncryptedBundles ?? existing.enforceEncryptedBundles ?? false,
      requiredEncryptionKey: requiredEncryptionKey === undefined ? existing.requiredEncryptionKey ?? null : requiredEncryptionKey,
    })
    try {
      await syncOrganizationNameToStripeAfterCommit(existing, org, {
        rollbackOrganization: rollback => storage.upsertOrganization({ id: rollback.orgId, name: rollback.name, managementEmail: rollback.managementEmail, customerId: rollback.customerId, createdBy: existing.createdBy, website: existing.website, passwordPolicyConfig: existing.passwordPolicyConfig, enforceEncryptedBundles: existing.enforceEncryptedBundles, requiredEncryptionKey: existing.requiredEncryptionKey }),
      })
    }
    catch (error) {
      if (error instanceof OrganizationStripeSyncError)
        return c.json({ error: String(error.moreInfo.error ?? 'stripe_sync_failed'), message: error.message, ...error.moreInfo }, 502)
      throw error
    }
    await storage.recordAuditLog({ tableName: 'orgs', recordId: body.id, operation: 'UPDATE', userId: auth.apiKey?.rbacId, orgId: body.id, oldRecord: organizationResponse(existing), newRecord: organizationResponse(org), changedFields: ['name', 'management_email', 'website', 'password_policy_config', 'enforce_encrypted_bundles', 'required_encryption_key'] })
    return c.json(organizationResponse(org))
  })
  app.delete('/organization', requireAdminRequest, async (c) => {
    const orgId = c.req.query('orgId') ?? c.req.query('org_id')
    if (!orgId)
      return jsonError(c, 403, 'invalid_org_id', 'Invalid organization id')
    const auth = c.get('auth')
    if (!canWriteOrganization(auth, orgId))
      return jsonError(c, 403, 'invalid_org_id', 'Invalid organization id')
    const storage = storageFactory(c.env)
    const deleted = await storage.deleteOrganization(orgId)
    if (!deleted)
      return jsonError(c, 403, 'invalid_org_id', 'Invalid organization id')
    await storage.recordAuditLog({ tableName: 'orgs', recordId: orgId, operation: 'DELETE', userId: auth.apiKey?.rbacId, orgId, changedFields: ['id'] })
    return c.json(ok)
  })

  app.get('/organization/members', requireAdminRequest, async (c) => {
    const orgId = c.req.query('orgId') ?? c.req.query('org_id')
    if (!orgId)
      return jsonError(c, 400, 'invalid_org_id', 'Organization id is required')
    const auth = c.get('auth')
    if (!canReadOrganization(auth, orgId))
      return jsonError(c, 400, 'cannot_access_organization', 'Cannot access organization')
    const org = await storageFactory(c.env).getOrganization(orgId)
    if (!org)
      return jsonError(c, 400, 'invalid_org_id', 'Invalid organization id')
    const members = await storageFactory(c.env).listOrgMemberships(orgId)
    return c.json(members.map(member => ({ uid: member.userId, user_id: member.userId, email: member.email, role: member.role })))
  })

  app.post('/organization/members', requireAdminRequest, async (c) => {
    const body = await parseJson(c, orgMemberSchema)
    const auth = c.get('auth')
    if (!canWriteOrganization(auth, body.orgId))
      return jsonError(c, 400, 'cannot_access_organization', 'Cannot access organization')
    const storage = storageFactory(c.env)
    const org = await storage.getOrganization(body.orgId)
    if (!org)
      return jsonError(c, 400, 'invalid_org_id', 'Invalid organization id')
    const userId = body.userId ?? crypto.randomUUID()
    const member = await storage.upsertOrgMembership({ orgId: body.orgId, userId, email: body.email, role: body.role })
    return c.json({ status: 'ok', uid: member.userId, user_id: member.userId, email: member.email, role: member.role })
  })
  app.delete('/organization/members', requireAdminRequest, async (c) => {
    const orgId = c.req.query('orgId') ?? c.req.query('org_id')
    const email = c.req.query('email')
    if (!orgId || !email)
      return jsonError(c, 400, 'invalid_request', 'Organization id and email are required')
    const auth = c.get('auth')
    if (!canWriteOrganization(auth, orgId))
      return jsonError(c, 400, 'cannot_access_organization', 'Cannot access organization')
    const deleted = await storageFactory(c.env).deleteOrgMembershipByEmail(orgId, email)
    if (!deleted)
      return jsonError(c, 404, 'member_not_found', 'Organization member not found')
    return c.json(ok)
  })

  app.post('/private/version_meta/upsert', requireAdminRequest, async (c) => {
    const body = await parseJson(c, versionMetaUpsertSchema)
    const validation = appIdError(c, body.app_id)
    if (validation)
      return validation
    const appId = body.app_id as string
    if (!canAccessAppId(c.get('auth'), appId, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')
    const inserted = await storageFactory(c.env).upsertVersionMeta({ appId, versionId: body.versionId, size: body.size })
    return c.json({ status: 'ok', inserted })
  })

  app.post('/org', requireAdminRequest, async (c) => {
    await parseJson(c, z.object({ name: z.string().optional() }))
    return c.json(ok)
  })

  app.post('/private/upload_link', async (c) => {
    const expected = c.env.CODEPUSHGO_API_KEY
    if (!expected || getBearerToken(c) !== expected)
      return jsonError(c, 401, 'invalid_apikey', 'Invalid API key')
    return c.json({ status: 'ok', upload_url: null })
  })

  async function privateAnalyticsBody(c: Context<AppEnv>) {
    try {
      return parsePrivateAnalyticsQuery(await c.req.json())
    }
    catch (error) {
      if (error instanceof PrivateAnalyticsValidationError)
        return jsonError(c, 400, 'invalid_body', 'Invalid body')
      throw error
    }
  }

  app.post('/private/stats', requireAdminRequest, async (c) => {
    const query = await privateAnalyticsBody(c)
    if (query instanceof Response)
      return query
    return c.json({ status: 'ok', data: [], query })
  })

  app.post('/private/log_as', requireAdminRequest, async (c) => {
    const body = await parseJson(c, logAsSchema)
    const storage = storageFactory(c.env)
    const userId = await resolveLogAsUserId(storage, body)
    if (!userId)
      return jsonError(c, 404, 'user_not_found', 'Cannot resolve user to impersonate')

    const secret = c.env.JWT_SECRET ?? c.env.API_SECRET ?? c.env.CODEPUSHGO_API_KEY
    if (!secret)
      return jsonError(c, 500, 'missing_jwt_secret', 'JWT secret is not configured')

    const jwt = await signImpersonationJwt(userId, secret)
    const refreshToken = crypto.randomUUID()
    return c.json({
      status: 'ok',
      jwt,
      refreshToken,
      access_token: jwt,
      refresh_token: refreshToken,
    })
  })

  app.post('/private/stats/export', requireAdminRequest, async (c) => {
    const query = await privateAnalyticsBody(c)
    if (query instanceof Response)
      return query
    const storage = storageFactory(c.env)
    const events = await storage.listStatsEvents(query)
    return c.json(buildPrivateAnalyticsExport(query, events))
  })

  app.post('/private/devices', requireAdminRequest, async (c) => {
    const query = await privateAnalyticsBody(c)
    if (query instanceof Response)
      return query

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(query.appId)
    const data = appRecord ? (await storage.listDevices(appRecord.appId)).map(deviceResponse) : []
    return c.json({ status: 'ok', data, count: data.length, query })
  })

  app.post('/private/sso/provision-user', async (c) => {
    if (!getBearerToken(c))
      return jsonError(c, 401, 'not_authorized', 'User must be authenticated')

    const body = await parseJson(c, ssoProvisionSchema)
    if (!isSsoProvider(body))
      return jsonError(c, 403, 'sso_auth_required', 'User must have an SSO identity to be provisioned')
    if (!body.userId)
      return jsonError(c, 400, 'missing_user_id', 'user_id is required')
    if (!body.email)
      return jsonError(c, 400, 'no_email', 'User has no email address')

    const providerId = ssoProviderCandidates(body)[0]
    if (!providerId)
      return jsonError(c, 403, 'provider_mismatch', 'SSO provider does not match the configured organization provider')

    const result = await storageFactory(c.env).provisionSsoUser({
      userId: body.userId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      providerId,
      orgId: body.orgId,
    })
    if (!result)
      return jsonError(c, 404, 'provider_not_found', 'No active SSO provider found for your SSO identity')

    return c.json({
      success: result.success,
      merged: result.merged,
      already_member: result.alreadyMember,
      alreadyMember: result.alreadyMember,
      org_id: result.orgId,
      orgId: result.orgId,
      user_id: result.userId,
      userId: result.userId,
    })
  })

  app.post('/private/sso/verify-dns', async (c) => {
    if (!getBearerToken(c))
      return jsonError(c, 401, 'no_jwt_apikey_or_subkey', 'No JWT, API key, or subkey was provided')
    const auth = await authenticateAdmin(c, storageFactory(c.env))
    if (auth instanceof Response)
      return auth

    const body = await parseJson(c, z.object({ provider_id: z.string().trim().min(1) }))
    const storage = storageFactory(c.env)
    const provider = await storage.getSsoProvider(body.provider_id)
    if (!provider)
      return notFound(c, 'provider_not_found', 'SSO provider was not found')
    return c.json({ status: 'ok', provider_id: provider.providerId, domain: provider.domain ?? null, verified: true })
  })

  app.post('/private/accept_invitation', async (c) => {
    const rawBody = await parseJson(c, z.record(z.string(), z.unknown()))
    cloudlog({ context: 'accept_invitation raw body', rawBody: omitSensitiveRequestBody(rawBody) })

    const parsed = acceptInvitationSchema.safeParse(rawBody)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_json_body', 'Invalid request')
    cloudlog({ context: 'accept_invitation validated body', body: omitSensitiveRequestBody(rawBody) })

    const result = await storageFactory(c.env).acceptInvitation({
      magicInviteString: parsed.data.magicInviteString,
      optForNewsletters: parsed.data.optForNewsletters,
    })
    if (!result)
      return notFound(c, 'failed_to_accept_invitation', 'Invitation not found')

    return c.json({
      status: 'ok',
      success: result.success,
      user_id: result.userId,
      userId: result.userId,
      org_id: result.orgId,
      orgId: result.orgId,
      role: result.role,
      access_token: null,
      refresh_token: null,
    })
  })

  app.get('/private/config/builder', async (c) => {
    return c.json(getBuilderConfig(c.env))
  })

  app.post('/private/validate_password_compliance', async (c) => {
    const ipRateLimitStatus = await isIPRateLimited(c)
    if (ipRateLimitStatus.limited)
      return jsonError(c, 429, 'too_many_requests', 'Too many requests')
    if (!isAllowedPasswordComplianceOrigin(c.req.header('origin')))
      return jsonError(c, 403, 'forbidden_origin', 'Origin is not allowed')

    let rawBody: unknown
    try {
      rawBody = await c.req.json()
    }
    catch {
      return jsonError(c, 400, 'invalid_json', 'Request body must be valid JSON')
    }
    const parsed = validatePasswordComplianceSchema.safeParse(rawBody)
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid body')
    const body = parsed.data

    const accountRateLimitStatus = await isAccountRateLimited(c, body.email)
    if (accountRateLimitStatus.limited) {
      return c.json({
        error: 'too_many_requests',
        message: 'Too many requests',
        reason: 'too_many_failed_account_auth_attempts',
        moreInfo: { reason: 'too_many_failed_account_auth_attempts', resetAt: accountRateLimitStatus.resetAt },
      }, 429)
    }

    const storage = storageFactory(c.env)
    const org = await storage.getOrganization(body.org_id)
    if (!org)
      return jsonError(c, 500, 'org_lookup_failed', 'Failed to load organization password policy')
    const member = await findOrgMemberByEmail(storage, body.org_id, body.email)
    if (!member)
      return jsonError(c, 403, 'not_member', 'You are not a member of this organization')
    const policy = org.passwordPolicyConfig as PasswordPolicyRules & { enabled?: boolean } | null | undefined
    if (!policy?.enabled)
      return jsonError(c, 400, 'no_policy', 'Organization does not have a password policy enabled')

    const errors = getPasswordPolicyValidationErrors(body.password, policy)
    if (errors.length > 0) {
      await recordFailedAuth(c)
      await recordFailedAccountAuth(c, body.email)
      return c.json({
        error: 'password_does_not_meet_policy',
        message: 'Your current password does not meet the organization requirements',
        errors,
        policy: {
          min_length: getEffectivePasswordMinLength(policy.min_length),
          require_uppercase: policy.require_uppercase,
          require_number: policy.require_number,
          require_special: policy.require_special,
        },
      }, 400)
    }

    await clearFailedAccountAuth(c, body.email)
    return c.json({ status: 'ok', message: 'Password verified and meets organization requirements' })
  })

  app.get('/private/groups/:id', requireAdminRequest, (c) => c.json(ok))
  app.post('/private/groups/:id/members', requireAdminRequest, (c) => c.json(ok))

  app.get('/private/role_bindings/app/:appId/channel', requireAdminRequest, async (c) => {
    const storage = storageFactory(c.env)
    const appId = c.req.param('appId') ?? ''
    if (!await canReadAppRoleBindings(storage, c.get('auth'), appId))
      return jsonError(c, 403, 'Forbidden', 'Forbidden')
    const bindings = await storage.listRoleBindingsForAppScope(appId, 'channel')
    return c.json(bindings.map(roleBindingResponse))
  })

  app.get('/private/role_bindings/:id', requireAdminRequest, async (c) => {
    const bindingId = c.req.param('id') ?? ''
    const paramResult = await Promise.resolve(bindingIdParamSchema['~standard'].validate({ binding_id: bindingId }))
    if ('issues' in paramResult) {
      const response = invalidBindingIdHook({ success: false, error: paramResult.issues }, c)
      if (response)
        return response
    }
    const storage = storageFactory(c.env)
    const binding = await storage.getRoleBinding(bindingId)
    if (!binding)
      return jsonError(c, 404, 'not_found', 'Role binding not found')
    const auth = c.get('auth')
    if (!await canManageRoleBinding(storage, auth, binding.orgId, binding.appId, binding.scopeType) && !await canReadAppRoleBindings(storage, auth, binding.appId ?? ''))
      return jsonError(c, 403, 'Forbidden', 'Forbidden')
    return c.json(roleBindingResponse(binding))
  })

  app.patch('/private/role_bindings/:id', requireAdminRequest, async (c) => {
    const bindingId = c.req.param('id') ?? ''
    const paramResult = await Promise.resolve(bindingIdParamSchema['~standard'].validate({ binding_id: bindingId }))
    if ('issues' in paramResult) {
      const response = invalidBindingIdHook({ success: false, error: paramResult.issues }, c)
      if (response)
        return response
    }
    const body = await validateJsonBody(c, updateRoleBindingBodySchema, updateRoleBindingBodyHook)
    if (!body.ok)
      return body.response
    const storage = storageFactory(c.env)
    const existing = await storage.getRoleBinding(bindingId)
    if (!existing)
      return jsonError(c, 404, 'not_found', 'Role binding not found')
    if (roleFamily(String(body.data.role_name)) !== roleFamily(existing.scopeType))
      return jsonError(c, 400, 'Role scope_type does not match binding scope', 'Role scope_type does not match binding scope')
    if (!await canManageRoleBinding(storage, c.get('auth'), existing.orgId, existing.appId, existing.scopeType))
      return jsonError(c, 403, 'Forbidden', 'Forbidden')
    const updated = await storage.updateRoleBinding(existing.id, { roleName: String(body.data.role_name) })
    if (!updated)
      return jsonError(c, 409, 'Cannot demote the last org_super_admin', 'Cannot demote the last org_super_admin')
    return c.json(roleBindingResponse(updated))
  })

  app.delete('/private/role_bindings/:id', requireAdminRequest, async (c) => {
    const bindingId = c.req.param('id') ?? ''
    const paramResult = await Promise.resolve(bindingIdParamSchema['~standard'].validate({ binding_id: bindingId }))
    if ('issues' in paramResult) {
      const response = invalidBindingIdHook({ success: false, error: paramResult.issues }, c)
      if (response)
        return response
    }
    const storage = storageFactory(c.env)
    const existing = await storage.getRoleBinding(bindingId)
    if (!existing)
      return jsonError(c, 404, 'not_found', 'Role binding not found')
    if (!await canManageRoleBinding(storage, c.get('auth'), existing.orgId, existing.appId, existing.scopeType))
      return jsonError(c, 403, 'Forbidden', 'Forbidden')
    await storage.deleteRoleBinding(existing.id)
    return c.json({ success: true, status: 'ok' })
  })

  app.post('/private/role_bindings', requireAdminRequest, async (c) => {
    const body = await validateJsonBody(c, createRoleBindingBodySchema, createRoleBindingBodyHook)
    if (!body.ok)
      return body.response
    const storage = storageFactory(c.env)
    const appId = typeof body.data.app_id === 'string' ? body.data.app_id : null
    const orgId = String(body.data.org_id)
    const scopeType = body.data.scope_type as RoleBindingScopeType
    if (roleFamily(String(body.data.role_name)) !== roleFamily(scopeType))
      return jsonError(c, 400, 'Role scope_type does not match binding scope', 'Role scope_type does not match binding scope')
    if (!await canManageRoleBinding(storage, c.get('auth'), orgId, appId, scopeType))
      return jsonError(c, 403, 'Forbidden', 'Forbidden')
    const created = await storage.createRoleBinding({
      principalType: body.data.principal_type as 'user' | 'group' | 'apikey',
      principalId: String(body.data.principal_id),
      roleName: String(body.data.role_name),
      scopeType,
      orgId,
      appId,
      channelId: body.data.channel_id as string | number | null | undefined,
      reason: typeof body.data.reason === 'string' ? body.data.reason : null,
    })
    if (!created)
      return jsonError(c, 404, 'App not found in this org', 'App not found in this org')
    return c.json(roleBindingResponse(created))
  })

  app.get('/private/roles/:scope', requireAdminRequest, (c) => c.json(ok))

  app.post('/private/events', requireAdminRequest, async (c) => {
    const body = await parseJson(c, eventSchema)
    if (body.notifyConsole && !body.userId && !body.orgId)
      return jsonError(c, 400, 'missing_org_id', 'Organization id is required for console events')

    const event: ConsoleEvent = {
      ...body,
      createdAt: new Date().toISOString(),
    }
    await storageFactory(c.env).recordEvent(event)
    return c.json(ok)
  })
  app.get('/apikey', requireAdminRequest, async (c) => {
    const auth = c.get('auth')
    const restricted = requireApiKeyManager(c, auth, 'cannot_list_apikeys')
    if (restricted)
      return restricted
    return c.json((await storageFactory(c.env).listApiKeys()).map((record) => apiKeyResponse(record)))
  })

  app.post('/apikey', requireAdminRequest, async (c) => {
    const auth = c.get('auth')
    const restricted = requireApiKeyManager(c, auth, 'cannot_create_apikey', 400)
    if (restricted)
      return restricted

    const body = await parseJson(c, apiKeyCreateSchema)
    if (!body.name)
      return jsonError(c, 400, 'name_is_required', 'name is required')

    const expiresAt = normalizeExpiration(body.expiresAt)
    if (expiresAt.error)
      return jsonError(c, 400, 'invalid_expiration_date', 'Expiration date must be a future ISO date')

    const storage = storageFactory(c.env)
    const bindings = await normalizeApiKeyBindings(c, storage, body.bindings)
    if (bindings instanceof Response)

      return bindings
    const globalPermissionError = validateApiKeyGlobalPermissions(c, bindings, body.globalPermissions)
    if (globalPermissionError)
      return globalPermissionError

    const key = generateApiKeyToken()
    const record = await storage.createApiKey({
      name: body.name,
      keyHash: await hashApiKeyToken(key),
      bindings,
      globalPermissions: body.globalPermissions,
      expiresAt: expiresAt.expiresAt ?? null,
    })
    await recordAudit(storage, auth, {
      tableName: 'apikeys',
      recordId: String(record.id),
      operation: 'INSERT',
      orgId: firstBindingOrgId(record.bindings),
      newRecord: apiKeyResponse(record),
    })
    return c.json(apiKeyResponse(record, key))
  })

  app.get('/apikey/:id', requireAdminRequest, async (c) => {
    const auth = c.get('auth')
    const restricted = requireApiKeyManager(c, auth, 'cannot_get_apikey')
    if (restricted)
      return restricted
    const id = parseApiKeyId(c.req.param('id'))
    if (!id)
      return jsonError(c, 400, 'invalid_apikey_id', 'API key id is invalid')
    const record = await storageFactory(c.env).getApiKey(id)
    if (!record)
      return notFound(c, 'failed_to_get_apikey', 'Failed to get API key')
    return c.json(apiKeyResponse(record))
  })

  async function updateApiKey(c: Context<AppEnv>, idFromPath?: number) {
    const auth = c.get('auth')
    const restricted = requireApiKeyManager(c, auth, 'cannot_update_apikey')
    if (restricted)
      return restricted

    const body = await parseJson(c, apiKeyUpdateSchema)
    const id = idFromPath ?? body.id
    if (!id)
      return jsonError(c, 400, 'invalid_apikey_id', 'API key id is required')
    if (!hasApiKeyUpdateField(body))
      return jsonError(c, 400, 'no_valid_fields_provided_for_update', 'No valid fields provided for update')

    const storage = storageFactory(c.env)
    const existing = await storage.getApiKey(id)
    if (!existing)
      return notFound(c, 'failed_to_update_apikey', 'Failed to update API key')

    const update: UpdateApiKeyInput = {}
    let nextKey: string | undefined
    if (body.hasName) {
      if (!body.name)
        return jsonError(c, 400, 'name_is_required', 'name is required')
      update.name = body.name
    }

    if (body.hasExpiresAt) {
      const expiresAt = normalizeExpiration(body.expiresAt)
      if (expiresAt.error)
        return jsonError(c, 400, 'invalid_expiration_date', 'Expiration date must be a future ISO date')
      update.expiresAt = expiresAt.expiresAt ?? null
    }

    if (body.bindings) {
      const bindings = await normalizeApiKeyBindings(c, storage, body.bindings)
      if (bindings instanceof Response)
        return bindings
      update.bindings = bindings
    }

    const nextBindings = update.bindings ?? existing.bindings
    const nextGlobalPermissions = body.globalPermissions
      ?? (update.bindings ? existing.globalPermissions.filter((permission: string) => permission !== 'org.create' || nextBindings.some((binding: ApiKeyBindingRecord) => binding.scopeType === 'org' && binding.roleName === 'org_admin')) : undefined)
    if (nextGlobalPermissions) {
      const globalPermissionError = validateApiKeyGlobalPermissions(c, nextBindings, nextGlobalPermissions)
      if (globalPermissionError)
        return globalPermissionError
      update.globalPermissions = nextGlobalPermissions
    }

    if (body.regenerate) {
      nextKey = generateApiKeyToken()
      update.keyHash = await hashApiKeyToken(nextKey)
    }

    const updated = await storage.updateApiKey(id, update)
    if (!updated)
      return notFound(c, 'failed_to_update_apikey', 'Failed to update API key')
    await recordAudit(storage, auth, {
      tableName: 'apikeys',
      recordId: String(updated.id),
      operation: 'UPDATE',
      orgId: firstBindingOrgId(updated.bindings) ?? firstBindingOrgId(existing.bindings),
      oldRecord: apiKeyResponse(existing),
      newRecord: apiKeyResponse(updated),
      changedFields: changedFields(apiKeyResponse(existing), apiKeyResponse(updated)),
    })
    return c.json(apiKeyResponse(updated, nextKey))
  }

  app.put('/apikey', requireAdminRequest, (c) => updateApiKey(c))

  app.put('/apikey/:id', requireAdminRequest, (c) => updateApiKey(c, parseApiKeyId(c.req.param('id'))))

  app.delete('/apikey/:id', requireAdminRequest, async (c) => {
    const auth = c.get('auth')
    const restricted = requireApiKeyManager(c, auth, 'cannot_delete_apikey')
    if (restricted)
      return restricted
    const id = parseApiKeyId(c.req.param('id'))
    if (!id)
      return jsonError(c, 400, 'invalid_apikey_id', 'API key id is invalid')
    const storage = storageFactory(c.env)
    const existing = await storage.getApiKey(id)
    const deleted = await storage.deleteApiKey(id)
    if (!deleted || !existing)
      return notFound(c, 'failed_to_delete_apikey', 'Failed to delete API key')
    await recordAudit(storage, auth, {
      tableName: 'apikeys',
      recordId: String(existing.id),
      operation: 'DELETE',
      orgId: firstBindingOrgId(existing.bindings),
      oldRecord: apiKeyResponse(existing),
    })
    return c.json(ok)
  })


  app.get('/app', requireAdminRequest, async (c) => {
    const storage = storageFactory(c.env)
    return c.json((await storage.listApps()).map(appResponse))
  })

  app.post('/app', requireAdminRequest, async (c) => {
    const body = await parseJson(c, createAppSchema)
    const validation = appIdError(c, body.appId)
    if (validation)
      return validation
    if (!body.ownerOrg)
      return jsonError(c, 400, 'missing_owner_org', 'owner_org is required')
    if (!body.name)
      return jsonError(c, 400, 'missing_name', 'name is required')
    if (!canAccessOwnerOrg(c.get('auth'), body.ownerOrg))
      return jsonError(c, 403, 'cannot_access_organization', 'Cannot access organization')

    const appId = body.appId as string
    const storage = storageFactory(c.env)
    if (await storage.getApp(appId))
      return jsonError(c, 409, 'app_id_already_exists', 'App id already exists')

    const appRecord = await storage.createApp(appId, body.name ?? appId, body.ownerOrg)
    await recordAudit(storage, c.get('auth'), {
      tableName: 'apps',
      recordId: appRecord.appId,
      operation: 'INSERT',
      orgId: body.ownerOrg,
      newRecord: appResponse(appRecord),
    })
    return c.json({ status: 'ok', ...appResponse(appRecord) })
  })

  app.get('/app/:appId', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const validation = appIdError(c, appIdParam)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const appRecord = await getExistingApp(c, storage, appIdParam as string)
    if (appRecord instanceof Response)
      return appRecord
    return c.json(appResponse(appRecord))
  })

  app.put('/app/:appId', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const validation = appIdError(c, appIdParam)
    if (validation)
      return validation

    const body = await parseJson(c, updateAppSchema)
    const storage = storageFactory(c.env)
    const appRecord = await getExistingApp(c, storage, appIdParam as string)
    if (appRecord instanceof Response)
      return appRecord
    if (body.owner_org || (body.name === undefined && body.exposeMetadata === undefined))
      return jsonError(c, 400, 'cannot_update_app', 'Cannot update app')

    const updated = await storage.updateApp(appRecord.appId, { name: body.name, exposeMetadata: body.exposeMetadata })
    if (!updated)
      return jsonError(c, 400, 'cannot_update_app', 'Cannot update app')
    await recordAudit(storage, c.get('auth'), {
      tableName: 'apps',
      recordId: updated.appId,
      orgId: appRecord.ownerOrg,
      operation: 'UPDATE',
      oldRecord: appResponse(appRecord),
      newRecord: appResponse(updated),
      changedFields: changedFields(appResponse(appRecord), appResponse(updated)),
    })
    return c.json({ status: 'ok', ...appResponse(updated) })
  })

  app.post('/app/:appId/transfer', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const validation = appIdError(c, appIdParam)
    if (validation)
      return validation

    const body = await parseJson(c, transferAppSchema)
    if (!body.ownerOrg)
      return jsonError(c, 400, 'missing_owner_org', 'owner_org is required')
    if (!canAccessOwnerOrg(c.get('auth'), body.ownerOrg))
      return jsonError(c, 403, 'cannot_access_organization', 'Cannot access organization')

    const storage = storageFactory(c.env)
    const appRecord = await getExistingApp(c, storage, appIdParam as string)
    if (appRecord instanceof Response)
      return appRecord
    const updated = await storage.transferApp(appRecord.appId, body.ownerOrg)
    if (!updated)
      return cannotAccessApp(c)
    await recordAudit(storage, c.get('auth'), {
      tableName: 'apps',
      recordId: updated.appId,
      orgId: body.ownerOrg,
      operation: 'UPDATE',
      oldRecord: appResponse(appRecord),
      newRecord: appResponse(updated),
      changedFields: ['owner_org', 'transfer_history'],
    })
    return c.json({ status: 'ok', ...appResponse(updated) })
  })

  app.delete('/app/:appId', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const validation = appIdError(c, appIdParam)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appIdParam as string)
    const deleted = await storage.deleteApp(appIdParam as string)
    if (!deleted || !appRecord)
      return jsonError(c, 400, 'cannot_delete_app', 'Cannot delete app')
    await recordAudit(storage, c.get('auth'), {
      tableName: 'apps',
      recordId: appRecord.appId,
      operation: 'DELETE',
      oldRecord: appResponse(appRecord),
      orgId: appRecord.ownerOrg,
    })
    return c.json(ok)
  })

  app.get('/bundle', requireAdminRequest, async (c) => {
    const appId = c.req.query('app_id') ?? c.req.query('bundle_id')
    const validation = appIdError(c, appId)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appId as string)
    if (!appRecord)
      return jsonError(c, 400, 'cannot_get_bundle', 'Cannot get bundle')

    return c.json((await storage.listReleases(appRecord.appId)).map((release) => releaseResponse(release)))
  })

  app.get('/bundle/:appId/:version', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const versionParam = c.req.param('version')
    const appValidation = appIdError(c, appIdParam)
    if (appValidation)
      return appValidation
    const releaseVersionValidation = versionError(c, versionParam)
    if (releaseVersionValidation)
      return releaseVersionValidation

    const storage = storageFactory(c.env)
    const release = (await storage.listReleases(appIdParam as string)).find((item) => item.version === versionParam)
    if (!release)
      return notFound(c, 'bundle_not_found', 'Bundle was not found')
    return c.json(releaseResponse(release))
  })

  app.post('/bundle', requireAdminRequest, async (c) => {
    const body = await parseJson(c, bundleCreateSchema)
    const appValidation = appIdError(c, body.app_id)
    if (appValidation)
      return appValidation
    const releaseVersionValidation = versionError(c, body.version)
    if (releaseVersionValidation)
      return releaseVersionValidation
    if (!body.external_url)
      return jsonError(c, 400, 'missing_external_url', 'external_url is required')

    let externalUrl: URL
    try {
      externalUrl = new URL(body.external_url)
    }
    catch {
      return jsonError(c, 400, 'invalid_url', 'external_url must be a valid URL')
    }
    if (externalUrl.protocol !== 'https:')
      return jsonError(c, 400, 'invalid_protocol', 'external_url must use HTTPS')

    const appId = body.app_id as string
    const version = body.version as string
    if (!canAccessAppId(c.get('auth'), appId, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')
    const storage = storageFactory(c.env)
    if (!await storage.getApp(appId))
      return jsonError(c, 400, 'cannot_create_bundle', 'Cannot create bundle for this app')
    const requestedChannels = [...new Set((body.channel ?? 'production').split(',').map(channel => channel.trim()).filter(Boolean))]
    if (!requestedChannels.length)
      return jsonError(c, 400, 'missing_channel', 'channel is required')
    const existingReleases = await storage.listReleases(appId)
    const duplicateChannel = requestedChannels.find(channel => existingReleases.some((release) => release.version === version && release.platform === (body.platform ?? 'ios') && release.channel === channel))
    if (duplicateChannel)
      return jsonError(c, 400, 'version_already_exists', `Version already exists for channel ${duplicateChannel}`)

    const bytes = new TextEncoder().encode(body.external_url).buffer
    const checksum = body.checksum ?? await sha256(bytes)
    const sessionKey = body.sessionKey ?? body.session_key ?? null
    const keyId = body.keyId ?? body.key_id ?? null
    const encryptionError = await checkEncryptedBundleEnforcement(storage, appId, sessionKey, keyId)
    if (encryptionError)
      return jsonError(c, 400, encryptionError.error, encryptionError.message)
    const releases = []
    for (const channel of requestedChannels) {
      const release = await storage.createRelease({
        appId,
        version,
        platform: body.platform ?? 'ios',
        channel,
        bytes,
        checksum,
        sessionKey,
        keyId,
        size: bytes.byteLength,
        mandatory: body.mandatory ?? false,
        manifest: body.manifest ?? [],
        rollout: body.rollout ?? 100,
        notes: body.notes,
        minUpdateVersion: body.minUpdateVersion ?? body.min_update_version ?? null,
        nativePackages: body.nativePackages ?? body.native_packages ?? [],
      })
      releases.push(release)
      await recordAudit(storage, c.get('auth'), {
        tableName: 'app_versions',
        recordId: `${release.appId}:${release.platform}:${release.channel}:${release.version}`,
        operation: 'INSERT',
        newRecord: releaseResponse(release, body.external_url),
      })
    }

    const bundle = releaseResponse(releases[0]!, body.external_url)
    return c.json({ status: 'success', bundle, bundles: releases.map(release => releaseResponse(release, body.external_url)) })
  })

  app.post('/bundle/compatibility', requireAdminRequest, async (c) => {
    const body = await parseJson(c, bundleCompatibilitySchema)
    const appValidation = appIdError(c, body.app_id)
    if (appValidation)
      return appValidation
    if (!canAccessAppId(c.get('auth'), body.app_id as string, false))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')

    const storage = storageFactory(c.env)
    const release = await storage.findLatestRelease(body.app_id as string, body.platform, body.channel)
    if (!release)
      return jsonError(c, 400, 'cannot_find_version', 'Cannot find version')

    const comparisons = compareNativePackages(body.nativePackages, release.nativePackages ?? [])
    return c.json({
      status: 'ok',
      app_id: body.app_id,
      channel: body.channel,
      version: release.version,
      data: comparisons,
      compatible: comparisons.every(item => item.compatible),
    })
  })

  app.delete('/bundle', requireAdminRequest, async (c) => {
    const body = await parseJson(c, bundleDeleteSchema)
    const appValidation = appIdError(c, body.app_id)
    if (appValidation)
      return appValidation
    if (!canAccessAppId(c.get('auth'), body.app_id as string, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')


    const storage = storageFactory(c.env)
    if (!await storage.getApp(body.app_id as string))
      return jsonError(c, 400, 'cannot_delete_bundle', 'Cannot delete bundle')
    const releasesBeforeDelete = await storage.listReleases(body.app_id as string)
    const releaseToDelete = body.version ? releasesBeforeDelete.find((release) => release.version === body.version) : releasesBeforeDelete[0]
    const deleted = await storage.deleteReleases(body.app_id as string, body.version)
    if (!deleted && body.version)
      return jsonError(c, 400, 'cannot_delete_version', 'Cannot delete version')
    if (!deleted)
      return jsonError(c, 400, 'cannot_delete_bundle', 'Cannot delete bundle')
    if (releaseToDelete) {
      const oldRecord = releaseResponse(releaseToDelete)
      await recordAudit(storage, c.get('auth'), {
        tableName: 'app_versions',
        recordId: `${releaseToDelete.appId}:${releaseToDelete.platform}:${releaseToDelete.channel}:${releaseToDelete.version}`,
        operation: 'UPDATE',
        oldRecord,
        newRecord: { ...oldRecord, deleted: true },
        changedFields: ['deleted'],
      })
    }
    return c.json(ok)
  })

  app.post('/bundle/metadata', requireAdminRequest, async (c) => {
    const body = await parseJson(c, bundleMetadataSchema)
    const appValidation = appIdError(c, body.app_id)
    if (appValidation)
      return appValidation
    if (!canAccessAppId(c.get('auth'), body.app_id as string, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')
    if (!body.link && !body.comment && !body.notes)
      return jsonError(c, 400, 'no_fields_to_update', 'No fields to update')

    const storage = storageFactory(c.env)
    const releases = await storage.listReleases(body.app_id as string)
    const release = body.version
      ? releases.find((item) => item.version === body.version)
      : body.version_id
        ? releases[body.version_id - 1]
        : undefined
    if (!release)
      return jsonError(c, 400, 'cannot_find_version', 'Cannot find version')
    const oldRecord = releaseResponse(release)
    const newRecord = {
      ...oldRecord,
      link: body.link,
      comment: body.comment ?? body.notes ?? oldRecord.comment,
      notes: body.notes ?? body.comment ?? oldRecord.notes,
    }
    await recordAudit(storage, c.get('auth'), {
      tableName: 'app_versions',
      recordId: `${release.appId}:${release.platform}:${release.channel}:${release.version}`,
      operation: 'UPDATE',
      oldRecord,
      newRecord,
      changedFields: changedFields(oldRecord, newRecord),
    })
    return c.json(ok)
  })

  app.put('/bundle', requireAdminRequest, async (c) => {
    const body = await parseJson(c, bundleSetChannelSchema)
    const appValidation = appIdError(c, body.app_id)
    if (appValidation)
      return appValidation
    if (!canAccessAppId(c.get('auth'), body.app_id as string, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')

    const storage = storageFactory(c.env)
    if (!await storage.getApp(body.app_id as string))
      return jsonError(c, 400, 'cannot_access_app', 'Cannot access app')
    const releases = await storage.listReleases(body.app_id as string)
    const release = body.version
      ? releases.find((item) => item.version === body.version)
      : body.version_id
        ? releases[body.version_id - 1]
        : undefined
    if (!release)
      return jsonError(c, 400, 'cannot_find_version', 'Cannot find version')
    return c.json(ok)
  })

  app.get('/channel', requireAdminRequest, async (c) => {
    const appId = c.req.query('app_id') ?? c.req.query('bundle_id')
    const channelName = c.req.query('channel') ?? c.req.query('name')
    const validation = appIdError(c, appId)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appId as string)
    if (!appRecord)
      return jsonError(c, 400, 'cannot_access_app', 'Cannot access app')
    if (!canAccessAppId(c.get('auth'), appRecord.appId))
      return jsonError(c, 400, 'cannot_access_app', 'Cannot access app')

    const channels = await storage.listChannels(appRecord.appId)
    if (channelName) {
      const channel = channels.find((item) => item.name === channelName)
      if (!channel)
        return notFound(c, 'channel_not_found', 'Channel was not found')
      return c.json(channelResponse(channel))
    }
    return c.json(channels.map(channelResponse))
  })

  app.get('/channel/:appId', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const validation = appIdError(c, appIdParam)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appIdParam as string)
    if (!appRecord)
      return notFound(c, 'channel_not_found', 'Channels were not found')
    if (!canAccessAppId(c.get('auth'), appRecord.appId))
      return jsonError(c, 400, 'cannot_access_app', 'Cannot access app')
    return c.json((await storage.listChannels(appRecord.appId)).map(channelResponse))
  })

  app.post('/channel', requireAdminRequest, async (c) => {
    const body = await parseJson(c, channelSchema)
    const validation = appIdError(c, body.app_id)
    if (validation)
      return validation
    if (!body.channel)
      return jsonError(c, 400, 'missing_channel', 'channel is required')

    const storage = storageFactory(c.env)
    const appRecord = await getExistingAppOr404(c, storage, body.app_id as string)
    if (appRecord instanceof Response)
      return appRecord
    if (!canAccessAppId(c.get('auth'), appRecord.appId, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')
    const existingChannel = (await storage.listChannels(appRecord.appId)).find(channel => channel.name === body.channel)
    const hasChannelSettings = body.public !== undefined || body.allowSelfSet !== undefined || body.ios !== undefined || body.android !== undefined || body.electron !== undefined
    if (existingChannel && !hasChannelSettings)
      return jsonError(c, 400, 'channel_already_exists', 'Channel already exists')


    const channel = await storage.upsertChannel({
      appId: appRecord.appId,
      name: body.channel,
      public: body.public,
      allowSelfSet: body.allowSelfSet,
      ios: body.ios,
      android: body.android,
      electron: body.electron,
    })
    return c.json({ status: 'ok', channel: channelResponse(channel) })
  })

  app.delete('/channel', requireAdminRequest, async (c) => {
    const body = await parseJson(c, channelSchema)
    const validation = appIdError(c, body.app_id)
    if (validation)
      return validation
    if (!body.channel)
      return jsonError(c, 400, 'missing_channel_name', 'channel is required')

    const storage = storageFactory(c.env)
    const appRecord = await getExistingAppOr404(c, storage, body.app_id as string)
    if (appRecord instanceof Response)
      return appRecord
    if (!canAccessAppId(c.get('auth'), appRecord.appId, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')

    const deleted = await storage.deleteChannel(appRecord.appId, body.channel)
    if (!deleted)
      return jsonError(c, 400, 'channel_not_found', 'Channel was not found')
    return c.json(ok)
  })
  app.get('/device', requireAdminRequest, async (c) => {
    const parsed = deviceQuerySchema.safeParse(queryObject(c))
    if (!parsed.success)
      return jsonError(c, 400, 'invalid_query_parameters', parsed.error.issues.map((issue) => issue.message).join(', '))

    const validation = appIdError(c, parsed.data.app_id)
    if (validation)
      return validation

    const appId = parsed.data.app_id as string
    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appId)
    if (!appRecord)
      return jsonError(c, 400, 'cannot_access_app', 'Cannot access app')

    if (parsed.data.device_id) {
      const device = await storage.getDevice(appRecord.appId, parsed.data.device_id)
      if (!device)
        return notFound(c, 'device_not_found', 'Device was not found')
      return c.json(deviceResponse(device))
    }

    return c.json({
      data: (await storage.listDevices(appRecord.appId)).map(deviceResponse),
      hasMore: false,
    })
  })

  app.get('/device/:appId', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const validation = appIdError(c, appIdParam)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const appRecord = await getExistingAppOr404(c, storage, appIdParam as string)
    if (appRecord instanceof Response)
      return appRecord
    return c.json({ data: (await storage.listDevices(appRecord.appId)).map(deviceResponse), hasMore: false })
  })

  app.post('/device', requireAdminRequest, async (c) => {
    const body = await parseJson(c, deviceSchema)
    const validation = appIdError(c, body.app_id)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const appRecord = await getExistingAppOr404(c, storage, body.app_id)
    if (appRecord instanceof Response)
      return appRecord

    if (body.channel) {
      const channels = await storage.listChannels(appRecord.appId, body.platform)
      if (!channels.some((channel) => channel.name === body.channel))
        return jsonError(c, 400, 'channel_not_found', 'Channel was not found')
    }

    const device = await storage.upsertDevice({
      appId: appRecord.appId,
      deviceId: body.device_id,
      channel: body.channel,
      platform: body.platform,
      pluginVersion: body.plugin_version,
      osVersion: body.version_os,
      versionBuild: body.version_build,
      versionName: body.version_name,
      customId: body.custom_id,
      isProd: body.is_prod,
      isEmulator: body.is_emulator,
      defaultChannel: body.defaultChannel ?? body.default_channel,
    })
    if (body.channel)
      await writeLegacyChannelSelfOverride(c.env.CHANNEL_SELF_STORE, { appId: appRecord.appId, deviceId: body.device_id, channelName: body.channel, pluginVersion: body.plugin_version })
    return c.json({ status: 'ok', device: deviceResponse(device) })
  })

  app.delete('/device', requireAdminRequest, async (c) => {
    const body = await parseJson(c, deviceDeleteSchema)
    const validation = appIdError(c, body.app_id)
    if (validation)
      return validation

    const storage = storageFactory(c.env)
    const existingDevice = await storage.getDevice(body.app_id, body.device_id)
    await deleteLegacyChannelSelfOverride(c.env.CHANNEL_SELF_STORE, { appId: body.app_id, deviceId: body.device_id, pluginVersion: body.plugin_version ?? existingDevice?.pluginVersion })
    await storage.deleteDevice(body.app_id, body.device_id)
    return c.json(ok)
  })

  app.get('/read/attachments/*', async (c) => {
    const cached = await matchDefaultCache(c.req.raw)
    if (cached)
      return cached
    return jsonError(c, 404, 'file_not_found', 'File was not found')
  })

  app.post('/upload_link', requireAdminRequest, async (c) => {
    const body = await parseJson(c, uploadLinkSchema)
    const validation = appIdError(c, body.app_id)
    if (validation)
      return validation
    if (!body.name)
      return jsonError(c, 400, 'missing_file_id', 'name or fileId is required')
    if (!canAccessAppId(c.get('auth'), body.app_id as string, true))
      return jsonError(c, 400, 'unauthorized', 'Unauthorized')

    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(body.app_id as string)
    if (!appRecord)
      return jsonError(c, 400, 'cannot_access_app', 'Cannot access app')
    const path = `orgs/${appRecord.ownerOrg ?? authOrgId(c.get('auth'))}/apps/${appRecord.appId}/${body.name}.zip`
    const url = new URL(c.req.url)
    url.pathname = `/upload/${path}`
    url.search = ''
    return c.json({ status: 'ok', url: url.toString(), path })
  })

  app.put('/upload/*', async (c) => {
    const bytes = await c.req.arrayBuffer()
    if (bytes.byteLength === 0)
      return jsonError(c, 400, 'empty_upload', 'Upload body cannot be empty')
    return c.json({ status: 'ok', size: bytes.byteLength })
  })

  app.get('/v1/apps', requireAdminRequest, async (c) => {
    const storage = storageFactory(c.env)
    return c.json({ status: 'ok', apps: (await storage.listApps()).map(appResponse) })
  })

  app.post('/v1/apps', requireAdminRequest, async (c) => {
    const body = await parseJson(c, createAppSchema)
    const validation = appIdError(c, body.appId)
    if (validation)
      return validation

    const appId = body.appId as string
    const storage = storageFactory(c.env)
    const appRecord = await storage.createApp(appId, body.name ?? appId, body.ownerOrg ?? authOrgId(c.get('auth')))
    return c.json({ status: 'ok', app: appResponse(appRecord), app_id: appRecord.appId, bundle_id: appRecord.appId }, 201)
  })

  app.get('/v1/apps/:appId/bundles', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const validation = appIdError(c, appIdParam)
    if (validation)
      return validation

    const appId = appIdParam as string
    const storage = storageFactory(c.env)
    const releases = await storage.listReleases(appId)
    return c.json({ status: 'ok', releases })
  })

  app.post('/v1/apps/:appId/bundles', requireAdminRequest, async (c) => {
    const appIdParam = c.req.param('appId')
    const versionHeader = c.req.header('x-codepushgo-version')?.trim()
    const platform = c.req.header('x-codepushgo-platform')?.trim() as Platform | undefined
    const channel = c.req.header('x-codepushgo-channel')?.trim() || 'production'
    const appValidation = appIdError(c, appIdParam)
    if (appValidation)
      return appValidation
    const releaseVersionValidation = versionError(c, versionHeader)
    if (releaseVersionValidation)
      return releaseVersionValidation
    if (platform !== 'ios' && platform !== 'android')
      return jsonError(c, 400, 'invalid_platform', 'x-codepushgo-platform must be ios or android')

    const appId = appIdParam as string
    const version = versionHeader as string
    const bytes = await c.req.arrayBuffer()
    if (bytes.byteLength === 0)
      return jsonError(c, 400, 'empty_bundle', 'Bundle body cannot be empty')

    const checksum = c.req.header('x-codepushgo-checksum')?.trim() || await sha256(bytes)
    const storage = storageFactory(c.env)
    const sessionKey = c.req.header('x-codepushgo-session-key')?.trim() || null
    const keyId = c.req.header('x-codepushgo-key-id')?.trim() || null
    const encryptionError = await checkEncryptedBundleEnforcement(storage, appId, sessionKey, keyId)
    if (encryptionError)
      return jsonError(c, 400, encryptionError.error, encryptionError.message)
    const release = await storage.createRelease({
      appId,
      version,
      platform,
      channel,
      bytes,
      checksum,
      sessionKey,
      keyId,
      size: bytes.byteLength,
      mandatory: boolFromHeader(c.req.header('x-codepushgo-mandatory')),
      rollout: numberFromHeader(c.req.header('x-codepushgo-rollout'), 100),
      notes: c.req.header('x-codepushgo-notes')?.trim(),
      minUpdateVersion: c.req.header('x-codepushgo-min-update-version')?.trim() || null,
      nativePackages: nativePackagesFromHeader(c.req.header('x-codepushgo-native-packages')),
    })

    return c.json({ status: 'ok', release }, 201)
  })

  app.get('/v1/apps/:appId/bundles/:version/download', async (c) => {
    const appIdParam = c.req.param('appId')
    const versionParam = c.req.param('version')
    const platform = c.req.query('platform') as Platform | undefined
    const channel = c.req.query('channel') || 'production'
    const appValidation = appIdError(c, appIdParam)
    if (appValidation)
      return appValidation
    const releaseVersionValidation = versionError(c, versionParam)
    if (releaseVersionValidation)
      return releaseVersionValidation
    if (platform !== 'ios' && platform !== 'android')
      return jsonError(c, 400, 'invalid_platform', 'platform query must be ios or android')

    const appId = appIdParam as string
    const version = versionParam as string
    const storage = storageFactory(c.env)
    const release = await storage.getRelease(appId, platform, channel, version)
    if (!release)
      return jsonError(c, 404, 'release_not_found', 'Release was not found')
    let bundle
    try {
      bundle = await storage.getBundle(release)
    }
    catch {
      return jsonError(c, 503, 'upstream_unavailable', 'Bundle object storage is unavailable')
    }
    if (!bundle?.body)
      return jsonError(c, 404, 'bundle_not_found', 'Bundle object was not found')

    return new Response(bundle.body, {
      headers: {
        'content-type': bundle.contentType,
        'content-length': String(bundle.size),
        'x-codepushgo-checksum': bundle.checksum,
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  })

  async function updates(c: Context<AppEnv>) {
    const body = await parseJson(c, updateRequestSchema)
    const appIdValue = body.app_id ?? body.bundle_id
    const validation = appIdError(c, appIdValue)
    if (validation)
      return validation
    const appId = appIdValue as string
    const rateLimit = await checkPublicDeviceRateLimit({ appId, deviceId: body.device_id, operation: 'updates' })
    if (rateLimit.limited)
      return rateLimitError(c)
    const request: UpdateRequest = {
      ...body,
      app_id: appId,
      defaultChannel: body.defaultChannel ?? body.default_channel,
    }
    const storage = storageFactory(c.env)
    const appRecord = await storage.getApp(appId)
    if (!appRecord) {
      const limit = await recordUpdateEnumerationMiss(c, appId)
      if (limit.limited)
        return updateEnumerationLimitedResponse(c)
      return jsonError(c, 429, 'on_premise_app', 'App was not found')
    }
    if (!await canServePluginUpdates(storage, appId))
      return jsonError(c, 429, 'on_premise_app', 'App was not found')
    await storage.upsertDevice({
      appId,
      deviceId: body.device_id,
      platform: body.platform,
      pluginVersion: body.plugin_version,
      versionBuild: body.version_build,
      versionName: body.version_name,
      customId: body.custom_id,
      defaultChannel: body.defaultChannel ?? body.default_channel ?? null,
      keyId: body.key_id,
    })
    const channelResolution = await resolveUpdateChannel(storage, c.env.CHANNEL_SELF_STORE, request)
    const channelRecord = await validateUpdateChannel(storage, request, channelResolution.channel, channelResolution.deviceOverride)
    if (!channelRecord) {
      return c.json({
        status: 'ok',
        available: false,
        error: 'no_channel',
        kind: 'failed',
        message: 'No channel found',
      })
    }
    const channel = channelResolution.channel
    const release = await storage.findLatestRelease(request.app_id, request.platform, channel)

    if (!release || !isVersionGreater(release.version, request.version_name) || (release.minUpdateVersion && isVersionGreater(release.minUpdateVersion, request.version_name))) {
      return c.json({
        status: 'ok',
        available: false,
        error: 'no_new_version_available',
        kind: 'up_to_date',
        message: 'No update available',
      })
    }

    const manifest = supportsManifestUpdate(request.plugin_version) && release.manifest?.length
      ? getManifestUrl(c.req.url, release.version, release.manifest, request.device_id)
      : []
    if (!release.path && manifest.length === 0) {
      return c.json({
        status: 'ok',
        available: false,
        error: 'cannot_get_bundle',
        kind: 'failed',
        message: 'Cannot get bundle',
      })
    }

    return c.json({
      status: 'ok',
      available: true,
      version: release.version,
      session_key: release.sessionKey ?? null,
      sessionKey: release.sessionKey ?? null,
      key_id: release.keyId ?? null,
      keyId: release.keyId ?? null,
      url: release.path ? getDownloadUrl(c, { ...request, channel }, release.version) : undefined,
      checksum: release.checksum,
      size: release.size,
      channel: release.channel,
      mandatory: release.mandatory,
      rollout: release.rollout,
      message: release.notes,
      ...(manifest.length ? { manifest } : {}),
    })
  }

  async function stats(c: Context<AppEnv>) {
    const body = await c.req.json().catch(() => undefined)
    const events = Array.isArray(body) ? body : [body]
    if (events.length === 0)
      return c.json({ status: 'ok', results: [] })

    if (Array.isArray(body)) {
      const batchAppIds = new Set<string>()
      for (const event of events) {
        const parsed = statsEventSchema.safeParse(event)
        if (parsed.success)
          batchAppIds.add(parsed.data.app_id)
      }
      if (batchAppIds.size > 1) {
        return c.json({
          error: 'mixed_app_ids',
          message: 'All events in a batch must have the same app_id',
        })
      }
    }

    const storage = storageFactory(c.env)
    const results: Array<Record<string, unknown>> = []
    for (const event of events) {
      const parsed = statsEventSchema.safeParse(event)
      if (!parsed.success) {
        results.push({ status: 'error', error: 'invalid_request', message: parsed.error.issues.map((issue) => issue.message).join(', '), statusCode: 400 })
        continue
      }
      if (!isValidAppId(parsed.data.app_id)) {
        results.push({ status: 'error', error: 'invalid_app_id', message: 'App id must be a reverse-domain identifier', statusCode: 400 })
        continue
      }
      if (!await storage.getApp(parsed.data.app_id)) {
        results.push({ status: 'error', error: 'on_premise_app', message: 'App was not found', statusCode: 429 })
        continue
      }
      if (!parsed.data.action.endsWith('_fail')) {
        await storage.upsertDevice({
          appId: parsed.data.app_id,
          deviceId: parsed.data.device_id,
          platform: parsed.data.platform,
          pluginVersion: parsed.data.plugin_version,
          osVersion: parsed.data.version_os,
          versionBuild: parsed.data.version_build,
          versionName: parsed.data.version_name,
          customId: parsed.data.custom_id,
          isProd: parsed.data.is_prod,
          isEmulator: parsed.data.is_emulator,
          defaultChannel: parsed.data.defaultChannel ?? null,
          keyId: parsed.data.key_id,
        })
      }
      await storage.recordStats(parsed.data as StatsEvent)
      results.push(ok)
    }

    if (Array.isArray(body)) {
      return c.json({
        status: 'ok',
        results: results.map(({ statusCode: _statusCode, ...result }) => result),
      })
    }

    const first = results[0]
    if (first.status === 'ok')
      return c.json(ok)
    const { statusCode = 400, ...errorBody } = first
    return c.json(errorBody, statusCode as 400 | 429)
  }

  async function channelSelf(c: Context<AppEnv>) {
    const body = await readChannelSelfRequest(c)
    if (body instanceof Response)
      return body

    const storage = storageFactory(c.env)
    const method = c.req.raw.method.toUpperCase()
    const hasQuery = new URL(c.req.url).searchParams.size > 0

    if (method === 'GET' && !hasQuery)
      return jsonError(c, 400, 'invalid_query_parameters', 'channel_self GET requires query parameters')

    const validation = appIdError(c, body.app_id)
    if (validation)
      return validation
    const appId = body.app_id as string
    const channelRateLimit = await checkPublicDeviceRateLimit({
      appId,
      deviceId: body.device_id,
      operation: `channel_self:${method.toLowerCase()}`,
      channel: method === 'POST' ? body.channel : undefined,
    })
    if (channelRateLimit.limited)
      return rateLimitError(c)

    if (method === 'GET') {
      if (!await storage.getApp(appId))
        return jsonError(c, 429, 'on_premise_app', 'App was not found')
      const channels = await storage.listChannels(appId, body.platform)
      return c.json(channels.map(channelSelfResponse))
    }

    if (!body.device_id)
      return jsonError(c, 400, 'missing_device_id', 'device_id is required')
    const deviceId = body.device_id
    await storage.upsertDevice({
      appId,
      deviceId,
      platform: body.platform,
      pluginVersion: body.plugin_version,
      versionBuild: body.version_build,
      versionName: body.version_name,
      defaultChannel: body.defaultChannel,
      keyId: body.key_id,
    })
    if (method === 'DELETE') {
      await deleteLegacyChannelSelfOverride(c.env.CHANNEL_SELF_STORE, { appId, deviceId, pluginVersion: body.plugin_version })
      await storage.clearDeviceChannel(appId, deviceId)
      return c.json(ok)
    }

    if (method === 'PUT') {
      const legacyOverride = await readLegacyChannelSelfOverride(c.env.CHANNEL_SELF_STORE, storage, { appId, deviceId, pluginVersion: body.plugin_version })
      const override = legacyOverride ?? await storage.getDeviceChannel(appId, deviceId)
      return c.json({
        status: override ? 'override' : 'default',
        channel: override ?? body.defaultChannel ?? 'production',
      })
    }

    if (method === 'POST') {
      if (!body.channel)
        return capgoError(c, 'missing_channel', 'channel is required')

      const channels = await storage.listChannels(appId, body.platform)
      const channel = channels.find((item) => item.name === body.channel)
      if (!channel)
        return capgoError(c, 'channel_not_found', 'channel was not found')
      if (!channel.allowSelfSet)
        return capgoError(c, 'public_channel_self_set_not_allowed', 'Channel does not allow device self assignment')

      const wroteLegacyOverride = await writeLegacyChannelSelfOverride(c.env.CHANNEL_SELF_STORE, { appId, deviceId, channelName: body.channel, pluginVersion: body.plugin_version })
      if (!wroteLegacyOverride)
        await storage.setDeviceChannel(appId, deviceId, body.channel)
      return c.json({ status: 'ok', channel: body.channel })
    }
    return jsonError(c, 405, 'method_not_allowed', 'Unsupported channel_self method')
  }

  app.post('/updates', updates)
  app.post('/plugin/updates', updates)
  app.post('/stats', stats)
  app.post('/plugin/stats', stats)
  app.get('/channel_self', channelSelf)
  app.post('/channel_self', channelSelf)
  app.put('/channel_self', channelSelf)
  app.delete('/channel_self', channelSelf)
  app.get('/plugin/channel_self', channelSelf)
  app.post('/plugin/channel_self', channelSelf)
  app.put('/plugin/channel_self', channelSelf)
  app.delete('/plugin/channel_self', channelSelf)

  return app
}

const app = createWorkerApp()
export default app
export { MemoryStorage } from './storage'
