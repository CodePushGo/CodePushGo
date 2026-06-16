import type { Platform } from '@codepushgo/shared'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { isValidAppId, isValidReleaseVersion } from '@codepushgo/shared'
import { CodePushGoApi } from './api'
import { zipDirectory, sha256 } from './archive'
import { configFileName, loadConfig, requireValue, writeConfig } from './config'
import { calcKeyId, createRSAKeys, encryptBundle } from './crypto'
import { runReactNativeBundle } from './react-native'
import { detectReactNativeBundleId } from './react-native-config'
import { resolvePlatform } from './platform'

interface CommonOptions {
  appId?: string
  endpoint?: string
  token?: string
  channel?: string
}

interface InitOptions extends CommonOptions {
  name?: string
  platform?: Platform
  connect?: boolean
}
interface BundleOptions {
  platform: Platform | string
  entryFile?: string
  outDir?: string
  dev?: boolean
  sourcemap?: boolean
}
interface UploadOptions extends CommonOptions {
  platform: Platform | string
  version: string
  bundleDir: string
  mandatory?: boolean
  rollout?: string
  notes?: string
  encrypt?: boolean
  key?: string
  publicKey?: string
}

interface ReleaseOptions extends CommonOptions, BundleOptions {
  version: string
  mandatory?: boolean
  rollout?: string
  notes?: string
  encrypt?: boolean
  key?: string
  publicKey?: string
}

interface KeyCreateOptions {
  force?: boolean
}

export const privateKeyFileName = '.codepushgo_key_v2'
export const publicKeyFileName = '.codepushgo_key_v2.pub'

function defaultEndpoint() {
  return process.env.CODEPUSHGO_ENDPOINT ?? 'http://localhost:8787'
}

function defaultChannel(channel?: string) {
  return channel ?? process.env.CODEPUSHGO_CHANNEL ?? 'production'
}

export function requireValidAppId(appId: string) {
  if (!isValidAppId(appId))
    throw new Error('CodePushGo app id must be a reverse-domain React Native bundle id')
  return appId
}

export function requireValidReleaseVersion(version: string) {
  if (!isValidReleaseVersion(version))
    throw new Error('CodePushGo release version must be strict semver without a leading v')
  return version
}

async function apiFor(options: CommonOptions) {
  const config = await loadConfig()
  return new CodePushGoApi({
    endpoint: options.endpoint ?? config.endpoint ?? defaultEndpoint(),
    token: requireValue(options.token ?? config.token ?? process.env.CODEPUSHGO_TOKEN, 'CodePushGo token'),
  })
}

export async function resolveAppId(options: CommonOptions & { platform?: Platform }, initialAppId?: string) {
  const config = await loadConfig()
  const detected = detectReactNativeBundleId(process.cwd(), options.platform)
  const appId = requireValue(
    initialAppId
      ?? options.appId
      ?? detected?.bundleId
      ?? config.appId
      ?? process.env.CODEPUSHGO_APP_ID,
    'CodePushGo app id. Pass it, set CODEPUSHGO_APP_ID, or add an RN bundle id in app.json/android/ios project files',
  )
  return requireValidAppId(appId)
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2))
}

async function readEncryptionKeys(options: UploadOptions | ReleaseOptions) {
  const config = await loadConfig()
  const privateKeyPath = options.key ?? privateKeyFileName
  const publicKeyPath = options.publicKey ?? publicKeyFileName
  const privateKey = await readFile(privateKeyPath, 'utf8')
  const publicKey = existsSync(publicKeyPath) ? await readFile(publicKeyPath, 'utf8') : config.publicKey
  if (!privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'))
    throw new Error('CodePushGo private key must be an RSA private key')
  if (!publicKey?.startsWith('-----BEGIN RSA PUBLIC KEY-----'))
    throw new Error('CodePushGo public key must be an RSA public key')
  return { privateKey, publicKey }
}

export async function handleInit(options: InitOptions) {
  const existing = await loadConfig()
  const detected = detectReactNativeBundleId(process.cwd(), options.platform)
  const appId = options.appId ?? detected?.bundleId ?? existing.appId
  const endpoint = options.endpoint ?? existing.endpoint ?? defaultEndpoint()
  const token = options.token ?? existing.token
  const authToken = token ?? process.env.CODEPUSHGO_TOKEN
  const config = {
    appId: appId ? requireValidAppId(appId) : undefined,
    endpoint,
    token,
    channel: defaultChannel(options.channel ?? existing.channel),
    publicKey: existing.publicKey,
  }
  await writeConfig(config)

  let app: unknown
  if (config.appId && options.connect !== false && authToken) {
    const api = new CodePushGoApi({ endpoint, token: authToken })
    app = await api.createApp(config.appId, options.name ?? config.appId)
  }

  printJson({
    status: 'ok',
    file: configFileName,
    detectedBundleId: detected,
    bundleId: config.appId,
    connected: !!app,
    app,
    config,
  })
}

export async function handleAppsCreate(options: CommonOptions & { name?: string }, initialAppId?: string) {
  const api = await apiFor(options)
  const appId = await resolveAppId(options, initialAppId)
  printJson(await api.createApp(appId, options.name ?? appId))
}

export async function handleAppsList(options: CommonOptions) {
  const api = await apiFor(options)
  printJson(await api.listApps())
}

export async function handleBundlesList(options: CommonOptions, initialAppId?: string) {
  const api = await apiFor(options)
  const appId = await resolveAppId(options, initialAppId)
  printJson(await api.listBundles(appId))
}
export async function handleBundle(options: BundleOptions) {
  const platform = resolvePlatform(options.platform)
  const outDir = options.outDir ?? `dist/codepushgo/${platform}`
  await runReactNativeBundle({
    platform,
    entryFile: options.entryFile ?? 'index.js',
    outDir,
    dev: options.dev ?? false,
    sourcemap: options.sourcemap ?? false,
  })
  printJson({ status: 'ok', outDir })
}

export async function handleUpload(options: UploadOptions, initialAppId?: string) {
  const platform = resolvePlatform(options.platform)
  const appId = await resolveAppId({ ...options, platform }, initialAppId)
  const version = requireValidReleaseVersion(options.version)
  const api = await apiFor(options)
  await api.createApp(appId, appId)

  const zipped = await zipDirectory(options.bundleDir)
  const checksum = sha256(zipped)
  let bytes = zipped
  let uploadChecksum = checksum
  let sessionKey: string | undefined
  let keyId: string | undefined

  if (options.encrypt) {
    const keys = await readEncryptionKeys(options)
    const encrypted = encryptBundle(zipped, checksum, keys.privateKey, keys.publicKey)
    bytes = encrypted.bytes
    uploadChecksum = encrypted.checksum
    sessionKey = encrypted.sessionKey
    keyId = encrypted.keyId
  }

  const response = await api.uploadBundle({
    appId,
    version,
    platform,
    channel: defaultChannel(options.channel),
    bytes,
    checksum: uploadChecksum,
    sessionKey,
    keyId,
    mandatory: options.mandatory ?? false,
    rollout: options.rollout ? Number(options.rollout) : 100,
    notes: options.notes,
  })
  printJson(response)
}

export async function handleRelease(options: ReleaseOptions, initialAppId?: string) {
  const platform = resolvePlatform(options.platform)
  const outDir = options.outDir ?? `dist/codepushgo/${platform}`
  await runReactNativeBundle({
    platform,
    entryFile: options.entryFile ?? 'index.js',
    outDir,
    dev: options.dev ?? false,
    sourcemap: options.sourcemap ?? false,
  })

  await handleUpload({
    ...options,
    platform,
    bundleDir: outDir,
  }, initialAppId)
}

export async function handleKeyCreate(options: KeyCreateOptions) {
  if (!options.force && (existsSync(privateKeyFileName) || existsSync(publicKeyFileName)))
    throw new Error('CodePushGo encryption keys already exist, use --force to overwrite')

  const keys = createRSAKeys()
  await writeFile(privateKeyFileName, keys.privateKey)
  await writeFile(publicKeyFileName, keys.publicKey)

  const config = await loadConfig()
  await writeConfig({ ...config, publicKey: keys.publicKey })
  printJson({
    status: 'ok',
    privateKey: privateKeyFileName,
    publicKey: publicKeyFileName,
    keyId: calcKeyId(keys.publicKey),
  })
}
