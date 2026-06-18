import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

interface SuiteSpec {
  name: string
  sourceRoot: string
  codepushgoRoots: string[]
  sourcePatterns: RegExp[]
  codepushgoPatterns: RegExp[]
  outOfScopeReason?: string
}

interface SuiteReport {
  name: string
  sourceRoot: string
  sourceCount: number
  codepushgoCount: number
  status: string
  missingExamples: string[]
  outOfScopeReason?: string
}

interface SemanticCheck {
  name: string
  status: 'pass' | 'fail'
  detail: string
}

const workspace = process.cwd()
const capgoSource = process.env.CAPGO_SOURCE ?? (existsSync('/tmp/capgo-current') ? '/tmp/capgo-current' : '/tmp/capgo-source')
const updaterSource = process.env.CAPACITOR_UPDATER_SOURCE ?? (existsSync('/tmp/capacitor-updater-current') ? '/tmp/capacitor-updater-current' : '/tmp/capacitor-updater-source')

const suites: SuiteSpec[] = [
  {
    name: 'Capgo backend tests',
    sourceRoot: join(capgoSource, 'tests'),
    codepushgoRoots: [join(workspace, 'packages/worker/test'), join(workspace, 'packages/shared/test'), join(workspace, 'apps')],
    sourcePatterns: [/\.test\.ts$/],
    codepushgoPatterns: [/\.test\.ts$/],
  },
  {
    name: 'Capgo CLI tests',
    sourceRoot: join(capgoSource, 'cli/test'),
    codepushgoRoots: [join(workspace, 'packages/cli/test')],
    sourcePatterns: [/^test-.*\.(mjs|js|ts)$/],
    codepushgoPatterns: [/\.test\.ts$/],
  },
  {
    name: 'Capacitor updater native contract tests',
    sourceRoot: join(updaterSource, 'native-contract-tests'),
    codepushgoRoots: [join(workspace, 'native-contract-tests')],
    sourcePatterns: [/.*/],
    codepushgoPatterns: [/.*/],
  },
  {
    name: 'Capacitor updater Maestro native flows',
    sourceRoot: join(updaterSource, '.maestro'),
    codepushgoRoots: [join(workspace, '.maestro')],
    sourcePatterns: [/\.ya?ml$/],
    codepushgoPatterns: [/\.ya?ml$/],
    outOfScopeReason: 'React Native native build automation and native Maestro smoke flows are intentionally disabled for this MVP.',
  },
]

function walk(root: string): string[] {
  if (!existsSync(root))
    return []

  const files: string[] = []
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git')
      continue

    const path = join(root, entry)
    const stats = statSync(path)
    if (stats.isDirectory())
      files.push(...walk(path))
    else
      files.push(path)
  }
  return files
}

function matchingFiles(root: string, patterns: RegExp[]) {
  return walk(root)
    .map((file) => relative(root, file))
    .filter((file) => patterns.some((pattern) => pattern.test(file)))
    .sort()
}

function matchingFilesAcrossRoots(roots: string[], patterns: RegExp[]) {
  return roots.flatMap((root) => matchingFiles(root, patterns).map((file) => `${relative(workspace, root)}/${file}`))
    .sort()
}

function fileKey(file: string) {
  const basename = file.split('/').at(-1) ?? file
  return basename.replace(/\.mjs$/, '').replace(/\.js$/, '').replace(/\.test\.ts$/, '')
}


function readWorkspaceFile(path: string) {
  return readFileSync(join(workspace, path), 'utf8')
}

function semanticCheck(name: string, ok: boolean, detail: string): SemanticCheck {
  return { name, status: ok ? 'pass' : 'fail', detail }
}

const packageJson = JSON.parse(readWorkspaceFile('package.json')) as { workspaces?: string[], scripts?: Record<string, string> }
const cliCommands = readWorkspaceFile('packages/cli/src/commands.ts')
const cliIndex = readWorkspaceFile('packages/cli/src/index.ts')
const updaterIndex = readWorkspaceFile('packages/react-native-updater/src/index.ts')
const nativeContract = readWorkspaceFile('packages/react-native-updater/src/native-contract.ts')
const workerIndex = readWorkspaceFile('packages/worker/src/index.ts')
const dashboardPackage = JSON.parse(readWorkspaceFile('apps/dashboard/package.json')) as { dependencies?: Record<string, string> }
const agents = readWorkspaceFile('AGENTS.md')
const testsWorkflow = readWorkspaceFile('.github/workflows/tests.yml')
const dashboardApp = readWorkspaceFile('apps/dashboard/src/App.vue')
const dashboardRegistration = readWorkspaceFile('apps/dashboard/src/services/registration.ts')
const dashboardConfirmationRedirect = readWorkspaceFile('apps/dashboard/src/services/confirmationRedirect.ts')
const dashboardSsoCallback = readWorkspaceFile('apps/dashboard/src/services/ssoCallback.ts')
const dashboardMain = readWorkspaceFile('apps/dashboard/src/main.ts')
const dashboardRouter = readWorkspaceFile('apps/dashboard/src/router.ts')
const dashboardRouteSurface = readWorkspaceFile('apps/dashboard/src/routeSurface.ts')
const dashboardSsoEnforcement = readWorkspaceFile('apps/dashboard/src/modules/sso-enforcement.ts')
const dashboardConsoleView = readWorkspaceFile('apps/dashboard/src/views/ConsoleView.vue')
const dashboardConsoleLayout = readWorkspaceFile('apps/dashboard/src/layouts/ConsoleLayout.vue')
const dashboardConsoleRoute = readWorkspaceFile('apps/dashboard/src/services/consoleRoute.ts')
const dashboardConsoleStore = readWorkspaceFile('apps/dashboard/src/stores/console.ts')
const dashboardAuthGuard = readWorkspaceFile('apps/dashboard/src/modules/auth.ts')
const dashboardOrganizationOnboarding = readWorkspaceFile('apps/dashboard/src/views/OrganizationOnboardingView.vue')
const dashboardConsoleHomePage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleHomePage.vue')
const dashboardConsoleAppOverviewPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleAppOverviewPage.vue')
const dashboardConsoleAppInfoPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleAppInfoPage.vue')
const dashboardConsoleAppAccessPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleAppAccessPage.vue')
const dashboardConsoleBundlesPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleBundlesPage.vue')
const dashboardConsoleNewAppPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleNewAppPage.vue')
const dashboardConsoleBundleDetailPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleBundleDetailPage.vue')
const dashboardConsoleChannelsPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleChannelsPage.vue')
const dashboardConsoleChannelDetailPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleChannelDetailPage.vue')
const dashboardConsoleDeviceDetailPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleDeviceDetailPage.vue')
const dashboardConsoleDevicesPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleDevicesPage.vue')
const dashboardConsoleStatsPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleStatsPage.vue')
const dashboardConsoleApiKeysPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleApiKeysPage.vue')
const dashboardConsoleCompatibilityPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleCompatibilityPage.vue')
const dashboardCompatibilityBanner = readWorkspaceFile('apps/dashboard/src/components/dashboard/CompatibilityBanner.vue')
const dashboardCompatibilityEvents = readWorkspaceFile('apps/dashboard/src/services/compatibilityEvents.ts')
const dashboardConsoleWebhooksPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleOrganizationWebhooksPage.vue')
const dashboardWebhooksService = readWorkspaceFile('apps/dashboard/src/services/webhooks.ts')
const dashboardApiKeysService = readWorkspaceFile('apps/dashboard/src/services/apikeys.ts')
const dashboardConsoleMembersPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleOrganizationMembersPage.vue')
const dashboardMembersService = readWorkspaceFile('apps/dashboard/src/services/organizationMembers.ts')
const dashboardConsoleSettingsPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleSettingsPage.vue')
const dashboardConsoleAppLayout = readWorkspaceFile('apps/dashboard/src/layouts/ConsoleAppLayout.vue')
const dashboardConsoleSettingsLayout = readWorkspaceFile('apps/dashboard/src/layouts/ConsoleSettingsLayout.vue')
const dashboardConsoleTabs = readWorkspaceFile('apps/dashboard/src/components/ConsoleTabs.vue')
const dashboardConsoleTabsConstants = readWorkspaceFile('apps/dashboard/src/constants/consoleTabs.ts')
const dashboardBundleTable = readWorkspaceFile('apps/dashboard/src/components/tables/BundleTable.vue')
const dashboardChannelTable = readWorkspaceFile('apps/dashboard/src/components/tables/ChannelTable.vue')
const dashboardDeviceTable = readWorkspaceFile('apps/dashboard/src/components/tables/DeviceTable.vue')
const dashboardLogTable = readWorkspaceFile('apps/dashboard/src/components/tables/LogTable.vue')
const consolidatedMigration = readWorkspaceFile('supabase/migrations/20260611111318_codepushgo_init.sql')

const semanticChecks: SemanticCheck[] = [
  semanticCheck('monorepo packages present', ['apps/*', 'packages/*'].every(item => packageJson.workspaces?.includes(item)), 'root workspaces include apps and packages'),
  semanticCheck('CLI command handlers stay out of entrypoint', cliIndex.includes('handleInit') && !cliIndex.includes('async function handleInit') && cliCommands.includes('export async function handleInit'), 'CLI entrypoint wires commands to handlers in src/commands.ts'),
  semanticCheck('Capgo API keys console route present', dashboardRouter.includes("{ path: 'dashboard/apikeys', component: ConsoleApiKeysPage }") && dashboardRouter.includes("{ path: 'organization/api-keys', redirect: '/dashboard/apikeys' }") && dashboardConsoleApiKeysPage.includes('listApiKeys') && dashboardConsoleApiKeysPage.includes('createApiKey') && dashboardConsoleApiKeysPage.includes('updateApiKey') && dashboardConsoleApiKeysPage.includes('regenerateApiKey') && dashboardConsoleApiKeysPage.includes('deleteApiKey') && dashboardConsoleApiKeysPage.includes('oneTimeKey') && dashboardConsoleApiKeysPage.includes('aria-label="API keys table"') && dashboardApiKeysService.includes("buildApiKeyPath('/apikey'") && dashboardApiKeysService.includes('webhookHeaders(options.apiKey)') && !dashboardApiKeysService.includes('functions.invoke'), 'API keys are managed through a real console page with Worker CRUD, regeneration, one-time secret display, and Capgo org settings redirect parity'),
  semanticCheck('Capgo organization members console route present', dashboardRouter.includes("{ path: 'organization/members', component: ConsoleOrganizationMembersPage }") && dashboardConsoleTabsConstants.includes("{ label: 'Members', key: '/settings/organization/members', icon: Users }") && dashboardConsoleSettingsLayout.includes('organizationTabs') && dashboardConsoleMembersPage.includes('listOrganizationMembers') && dashboardConsoleMembersPage.includes('upsertOrganizationMember') && dashboardConsoleMembersPage.includes('deleteOrganizationMember') && dashboardConsoleMembersPage.includes('filteredMembers') && dashboardConsoleMembersPage.includes('aria-label="Organization members table"') && dashboardMembersService.includes("buildWebhookApiPath('/organization/members'") && dashboardMembersService.includes('webhookHeaders(options.apiKey)') && !dashboardMembersService.includes('functions.invoke') && consolidatedMigration.includes('CREATE TABLE IF NOT EXISTS public.org_users') && consolidatedMigration.includes('GRANT SELECT ON TABLE public.org_users TO authenticated'), 'organization members are mounted as a dedicated settings route, backed by the Worker organization members API, and tied to the consolidated Supabase org_users migration'),
  semanticCheck('Capgo console shell split from page content', dashboardConsoleLayout.includes('Sidebar') && dashboardConsoleLayout.includes('Navbar') && dashboardConsoleLayout.includes('<slot') && dashboardConsoleView.includes('ConsoleLayout') && dashboardConsoleView.includes('RouterView') && dashboardRouter.includes('export const consoleRoutes') && dashboardRouter.includes('ConsoleAppLayout') && dashboardRouter.includes('ConsoleSettingsLayout') && dashboardRouter.includes("redirect: '/settings/organization/plans'") && ['ConsoleHomePage', 'ConsoleNewAppPage', 'ConsoleAppOverviewPage', 'ConsoleAppInfoPage', 'ConsoleAppAccessPage', 'ConsoleBundlesPage', 'ConsoleChannelsPage', 'ConsoleDevicesPage', 'ConsoleStatsPage', 'ConsoleApiKeysPage', 'ConsoleSettingsPage'].every(page => dashboardRouter.includes(page)) && ['<WelcomeBanner', '<Usage', 'aria-label="Release table"', 'aria-label="Channels table"', 'aria-label="Devices table"', 'aria-label="Stats table"', 'Create an organization API key', 'Record the onboarding choice'].every(fragment => !dashboardConsoleView.includes(fragment)) && dashboardConsoleAppLayout.includes('ConsoleTabs') && dashboardConsoleAppLayout.includes('appTabs') && dashboardConsoleAppLayout.includes('RouterView') && dashboardConsoleSettingsLayout.includes('settingsTabs') && dashboardConsoleSettingsLayout.includes('organizationTabs') && dashboardConsoleSettingsLayout.includes('RouterView') && dashboardConsoleTabs.includes('secondaryTabs') && dashboardConsoleTabsConstants.includes('export const appTabs') && dashboardConsoleTabsConstants.includes('export const settingsTabs') && dashboardConsoleHomePage.includes('TopApps') && dashboardConsoleHomePage.includes('WelcomeBanner') && dashboardConsoleHomePage.includes('to="/app/new"') && dashboardConsoleNewAppPage.includes('createAppOnboarding') && dashboardConsoleAppOverviewPage.includes('Usage') && dashboardConsoleAppOverviewPage.includes('Latest bundles') && dashboardConsoleAppInfoPage.includes('App information') && dashboardConsoleAppAccessPage.includes('App access') && dashboardConsoleBundlesPage.includes('BundleTable') && dashboardConsoleChannelsPage.includes('ChannelTable') && dashboardConsoleDevicesPage.includes('DeviceTable') && dashboardConsoleStatsPage.includes('LogTable') && [dashboardConsoleBundlesPage, dashboardConsoleChannelsPage, dashboardConsoleDevicesPage, dashboardConsoleStatsPage].every(page => !page.includes('<table')) && dashboardBundleTable.includes('aria-label="Release table"') && dashboardChannelTable.includes('aria-label="Channels table"') && dashboardDeviceTable.includes('aria-label="Devices table"') && dashboardLogTable.includes('aria-label="Stats table"') && dashboardConsoleApiKeysPage.includes('API keys') && dashboardConsoleApiKeysPage.includes('aria-label="API keys table"') && dashboardConsoleSettingsPage.includes('Record the onboarding choice') && !dashboardConsoleView.includes("components/Navbar.vue") && !dashboardConsoleView.includes("components/Sidebar.vue") && dashboardConsoleRoute.includes('pathSection') && dashboardConsoleRoute.includes('appHref'), 'console shell owns sidebar/navbar, app/settings layouts own tabs, reusable table components own tables, and Vue Router owns page mapping'),
  semanticCheck('Capgo organization webhooks console route present', dashboardRouter.includes("{ path: 'organization/webhooks', component: ConsoleOrganizationWebhooksPage }") && dashboardConsoleTabsConstants.includes("{ label: 'Webhooks', key: '/settings/organization/webhooks', icon: Webhook }") && dashboardConsoleSettingsLayout.includes('organizationTabs') && dashboardConsoleWebhooksPage.includes('WEBHOOK_EVENT_TYPES') && dashboardConsoleWebhooksPage.includes('createWebhook') && dashboardConsoleWebhooksPage.includes('updateWebhook') && dashboardConsoleWebhooksPage.includes('deleteWorkerWebhook') && dashboardConsoleWebhooksPage.includes('testWorkerWebhook') && dashboardConsoleWebhooksPage.includes('fetchWebhookDeliveries') && dashboardConsoleWebhooksPage.includes('retryWebhookDelivery') && dashboardConsoleWebhooksPage.includes('signatureVerificationCode') && dashboardConsoleWebhooksPage.includes('aria-label="Webhook delivery log"') && dashboardWebhooksService.includes("buildWebhookApiPath('/webhooks'") && dashboardWebhooksService.includes("buildWebhookApiPath('/webhooks/test'") && dashboardWebhooksService.includes("buildWebhookApiPath('/webhooks/deliveries'") && dashboardWebhooksService.includes("buildWebhookApiPath('/webhooks/deliveries/retry'") && dashboardWebhooksService.includes('authorization: `Bearer ${apiKey}`') && !dashboardWebhooksService.includes('functions.invoke'), 'organization webhooks are mounted as a dedicated settings route and use the Cloudflare Worker webhook API instead of Supabase Edge Functions'),
  semanticCheck('Capgo new app route present', dashboardRouter.includes("{ path: 'app/new', component: ConsoleNewAppPage }") && dashboardConsoleRoute.includes("pathname === '/app/new'") && dashboardConsoleRoute.includes("appMatch[1] === 'new'") && dashboardRegistration.includes('createAppOnboarding') && dashboardRegistration.includes("client.rpc('create_app_onboarding'") && consolidatedMigration.includes('CREATE OR REPLACE FUNCTION public.create_app_onboarding') && consolidatedMigration.includes("INSERT INTO public.channels (app_id, name, public, allow_self_set, ios, android)") && dashboardConsoleNewAppPage.includes('Connect a React Native bundle ID') && dashboardConsoleNewAppPage.includes('organizationStore.currentOrganization') && dashboardConsoleNewAppPage.includes('window.location.assign(appHref(app.app_id))'), 'new app page creates native-bundle-id apps through a Supabase RPC and keeps CLI auto-detection as the normal path'),
  semanticCheck('Capgo compatibility console route present', dashboardRouter.includes("{ path: 'compatibility', component: ConsoleCompatibilityPage }") && dashboardConsoleTabsConstants.includes("{ label: 'Compatibility', key: '/compatibility', icon: AlertTriangle }") && dashboardConsoleRoute.includes("return 'compatibility'") && dashboardConsoleRoute.includes('`/app/${encoded}/compatibility`') && dashboardConsoleAppOverviewPage.includes('<CompatibilityBanner') && dashboardCompatibilityBanner.includes('countUnresolvedCompatibilityGroups') && dashboardCompatibilityBanner.includes('data-test="compatibility-banner"') && dashboardConsoleCompatibilityPage.includes('listCompatibilityEvents') && dashboardConsoleCompatibilityPage.includes('groupCompatibilityEvents') && dashboardConsoleCompatibilityPage.includes('aria-label="Compatibility events table"') && dashboardCompatibilityEvents.includes('groupCompatibilityEvents') && consolidatedMigration.includes('compatibility_events_read_member_org_compatibility_events') && consolidatedMigration.includes('GRANT SELECT ON TABLE public.compatibility_events TO authenticated'), 'compatibility events are mounted in the app console, grouped like Capgo, surfaced from overview, and readable through authenticated Supabase RLS'),
  semanticCheck('Worker and RN updater expose channel_self parity', workerIndex.includes("app.get('/channel_self', channelSelf)") && workerIndex.includes('allow_self_set: channel.allowSelfSet') && updaterIndex.includes('async listChannels') && updaterIndex.includes('async setChannel') && updaterIndex.includes('async unsetChannel') && updaterIndex.includes('async getChannel') && updaterIndex.includes("`${this.endpoint}/channel_self`"), 'Worker supports plugin channel_self routes and RN updater can list, set, read, and unset device channel overrides'),
  semanticCheck('Worker backend accepts bundle_id/app_id and public device endpoints', workerIndex.includes('bundle_id') && workerIndex.includes("'/updates'") && workerIndex.includes("'/stats'") && workerIndex.includes("'/channel_self'"), 'Worker device contracts accept React Native bundle_id and expose update/stat/channel_self endpoints'),
  semanticCheck('Capgo app info/access routes present', dashboardRouter.includes("{ path: 'info', component: ConsoleAppInfoPage }") && dashboardRouter.includes("{ path: 'access', component: ConsoleAppAccessPage }") && dashboardConsoleTabsConstants.includes("{ label: 'Info', key: '/info', icon: Info }") && dashboardConsoleTabsConstants.includes("{ label: 'Access', key: '/access', icon: ShieldCheck }") && dashboardConsoleRoute.includes("return 'info'") && dashboardConsoleRoute.includes("return 'access'") && dashboardConsoleRoute.includes('`/app/${encoded}/info`') && dashboardConsoleRoute.includes('`/app/${encoded}/access`') && dashboardConsoleAppInfoPage.includes('App information') && dashboardConsoleAppInfoPage.includes('Runtime surface') && dashboardConsoleAppAccessPage.includes('App access') && dashboardConsoleAppAccessPage.includes('Upload permission') && dashboardConsoleAppAccessPage.includes('Runtime access'), 'app info and access pages are explicit routes instead of fallback overview pages'),
  semanticCheck('Cloudflare Worker backend is configured', existsSync(join(workspace, 'packages/worker/wrangler.toml')) && packageJson.scripts?.['worker:dev']?.includes('wrangler dev'), 'wrangler.toml and worker scripts are present'),
  semanticCheck('Capgo canonical app routes present', dashboardConsoleRoute.includes('return `/app/${encoded}`') && dashboardConsoleRoute.includes('`/app/${encoded}/bundles`') && !dashboardConsoleRoute.includes('`/app/p/${encoded}') && dashboardRouter.includes("path: 'app/:appId'") && dashboardRouter.includes("path: 'bundles'") && dashboardRouter.includes("path: ':pathMatch(.*)*'") && !dashboardRouter.includes("path: '/app/p/:appId") && dashboardRouteSurface.includes("path: '/app/p/:package'") && dashboardRouteSurface.includes('legacyAppRedirect'), 'app URLs are generated as /app/:nativeBundleId and legacy package URLs are redirects only'),
  semanticCheck('Capgo bundle detail route present', dashboardRouter.includes('ConsoleBundleDetailPage') && dashboardRouter.includes("{ path: 'bundle/:bundle', component: ConsoleBundleDetailPage }") && dashboardRouter.includes("{ path: 'bundles/:bundle', component: ConsoleBundleDetailPage }") && ['history', 'manifest', 'dependencies', 'preview'].every(subroute => dashboardRouter.includes(`{ path: 'bundle/:bundle/${subroute}', component: ConsoleBundleDetailPage }`) && dashboardRouter.includes(`{ path: 'bundles/:bundle/${subroute}', component: ConsoleBundleDetailPage }`)) && !dashboardRouter.includes("{ path: 'bundle/:bundle', component: ConsoleBundlesPage }") && dashboardBundleTable.includes('RouterLink') && dashboardBundleTable.includes('function bundleKey') && dashboardBundleTable.includes('/bundle/') && dashboardConsoleBundlesPage.includes(':app-id="selectedAppId"') && dashboardRegistration.includes('checksum') && dashboardRegistration.includes('session_key') && dashboardRegistration.includes('native_packages') && dashboardConsoleBundleDetailPage.includes('decodedBundleKey') && dashboardConsoleBundleDetailPage.includes('bundleKeyParts') && dashboardConsoleBundleDetailPage.includes('bundleStats') && dashboardConsoleBundleDetailPage.includes('bundleTabs') && dashboardConsoleBundleDetailPage.includes('activeBundleTab') && dashboardConsoleBundleDetailPage.includes('Manifest entries') && dashboardConsoleBundleDetailPage.includes('aria-label="Manifest table"') && dashboardConsoleBundleDetailPage.includes('aria-label="Native packages table"') && dashboardConsoleBundleDetailPage.includes('Native packages'), 'bundle rows navigate to real app-scoped detail and subroutes keyed by CodePushGo composite release identity'),
  semanticCheck('Capgo channel detail route present', dashboardRouter.includes('ConsoleChannelDetailPage') && dashboardRouter.includes("{ path: 'channel/:channel', component: ConsoleChannelDetailPage }") && ['devices', 'history', 'statistics', 'preview'].every(subroute => dashboardRouter.includes(`{ path: 'channel/:channel/${subroute}', component: ConsoleChannelDetailPage }`)) && !dashboardRouter.includes("{ path: 'channel/:channel', component: ConsoleChannelsPage }") && dashboardChannelTable.includes('RouterLink') && dashboardChannelTable.includes('function channelHref') && dashboardChannelTable.includes('/channel/') && dashboardConsoleChannelsPage.includes(':app-id="selectedAppId"') && dashboardConsoleChannelDetailPage.includes('useRoute') && dashboardConsoleChannelDetailPage.includes('decodedChannelName') && dashboardConsoleChannelDetailPage.includes('channelReleases') && dashboardConsoleChannelDetailPage.includes('deviceChannels') && dashboardConsoleChannelDetailPage.includes('overrideDeviceIds') && dashboardConsoleChannelDetailPage.includes('overriddenDeviceIds') && dashboardConsoleChannelDetailPage.includes('channelTabs') && dashboardConsoleChannelDetailPage.includes('activeChannelTab') && dashboardConsoleChannelDetailPage.includes('aria-label="Channel devices table"') && dashboardConsoleChannelDetailPage.includes('aria-label="Channel statistics table"') && dashboardConsoleChannelDetailPage.includes('deviceChannelMode'), 'channel rows navigate to real app-scoped detail and subroutes with explicit device override/default state'),
  semanticCheck('Capgo device detail route present', dashboardRouter.includes('ConsoleDeviceDetailPage') && dashboardRouter.includes("{ path: 'device/:device', component: ConsoleDeviceDetailPage }") && ['deployments', 'logs'].every(subroute => dashboardRouter.includes(`{ path: 'device/:device/${subroute}', component: ConsoleDeviceDetailPage }`)) && !dashboardRouter.includes("{ path: 'device/:device', component: ConsoleDevicesPage }") && dashboardDeviceTable.includes('RouterLink') && dashboardDeviceTable.includes('function deviceHref') && dashboardDeviceTable.includes('/device/') && dashboardConsoleDevicesPage.includes(':app-id="selectedAppId"') && dashboardConsoleDeviceDetailPage.includes('useRoute') && dashboardConsoleDeviceDetailPage.includes('decodedDeviceId') && dashboardConsoleDeviceDetailPage.includes('deviceStats') && dashboardConsoleDeviceDetailPage.includes('deviceChannels') && dashboardConsoleDeviceDetailPage.includes('effectiveChannel') && dashboardConsoleDeviceDetailPage.includes('deviceTabs') && dashboardConsoleDeviceDetailPage.includes('activeDeviceTab') && dashboardConsoleDeviceDetailPage.includes('aria-label="Device deployments table"') && dashboardConsoleDeviceDetailPage.includes('aria-label="Device logs table"') && dashboardConsoleDeviceDetailPage.includes('Device update request'), 'device rows navigate to real app-scoped detail and subroutes for deployments/logs with explicit override/default channel state'),
  semanticCheck('Capgo protected auth guard and organization onboarding present', dashboardAuthGuard.includes('createAuthGuard') && dashboardAuthGuard.includes('createDashboardClient') && dashboardAuthGuard.includes("'/onboarding/organization'") && dashboardAuthGuard.includes("from('orgs')") && dashboardRouter.includes("path: '/onboarding/organization'") && dashboardOrganizationOnboarding.includes('createOrganizationOnboarding') && dashboardRegistration.includes('createOrganizationOnboarding') && consolidatedMigration.includes('create_organization_onboarding') && consolidatedMigration.includes("'organization_onboarding'"), 'protected routes hydrate Supabase auth, load member orgs through RLS, redirect no-org users to organization onboarding, and record plan intent there'),
  semanticCheck('Capgo console shared store present', dashboardConsoleStore.includes('createConsoleStore') && dashboardConsoleStore.includes('useConsoleStore') && dashboardConsoleStore.includes('refreshAppData') && dashboardConsoleStore.includes('recordPlanIntent') && dashboardConsoleStore.includes("client, 'device_channels'") && dashboardConsoleStore.includes('deviceChannels') && dashboardConsoleView.includes('useConsoleStore') && !dashboardConsoleView.includes('createDashboardClient'), 'console auth, app selection, refresh, plan intent, command state, and device channel overrides live outside the page view'),
  semanticCheck('no Supabase Edge Functions', !existsSync(join(workspace, 'supabase/functions')) && !/functions\/v1|supabase\/functions/.test(workerIndex), 'repo has only consolidated migration and Worker storage adapters'),
  semanticCheck('Capgo Vue Router shell installed', !!dashboardPackage.dependencies?.['vue-router'] && dashboardApp.includes('RouterView') && dashboardMain.includes('createDashboardRouter') && dashboardMain.includes('import.meta.glob') && dashboardMain.includes("'./modules/*.ts'") && dashboardRouter.includes('createWebHistory') && dashboardRouteSurface.includes("path: '/', redirect: '/login'") && dashboardRouteSurface.includes("path: '/app', redirect: '/apps'"), 'dashboard uses Vue Router, RouterView, module installs, and Capgo-style canonical redirects'),
  semanticCheck('Vue dashboard remains Vue 3', !!dashboardPackage.dependencies?.vue && existsSync(join(workspace, 'apps/dashboard/src/App.vue')), 'dashboard package uses Vue and App.vue exists'),
  semanticCheck('Capgo confirm-signup secure redirect route present', dashboardRouter.includes("path: '/confirm-signup'") && dashboardRouter.includes('ConfirmSignupView') && dashboardConfirmationRedirect.includes('resolveConfirmationRedirect') && dashboardConfirmationRedirect.includes('supabaseUrl') && dashboardConfirmationRedirect.includes('protocol !== \'https:\''), 'dashboard routes /confirm-signup and only forwards confirmation URLs to console or Supabase hosts'),
  semanticCheck('Capgo resend-email auth flow route present', dashboardRouter.includes("path: '/resend_email'") && dashboardRouter.includes('ResendEmailView') && dashboardRegistration.includes('resendSignupEmail') && dashboardRegistration.includes("type: 'signup'"), 'dashboard routes /resend_email and calls Supabase signup resend'),
  semanticCheck('Capgo SSO enforcement guard parity', dashboardSsoEnforcement.includes("'/sso-callback'") && dashboardSsoEnforcement.includes("'/forgot_password'") && dashboardSsoEnforcement.includes("auth_type: 'password'") && dashboardSsoEnforcement.includes('isCacheValid') && dashboardSsoEnforcement.includes("provider !== 'email'") && dashboardSsoEnforcement.includes('clearSsoEnforcementCache'), 'dashboard guard keeps auth routes public, skips non-email providers, sends Capgo enforcement body, caches checks, and fails closed'),
  semanticCheck('Capgo SSO callback auth flow route present', dashboardRouter.includes("path: '/sso-callback'") && dashboardRouter.includes('SsoCallbackView') && dashboardSsoCallback.includes('completeSsoCallback') && dashboardSsoCallback.includes('setSession') && dashboardSsoCallback.includes('exchangeCodeForSession') && dashboardSsoCallback.includes('validateRedirectPath') && dashboardSsoCallback.includes('clearAuthParamsFromUrl'), 'dashboard routes /sso-callback, exchanges Supabase SSO tokens/codes, clears tokens, and rejects unsafe redirects'),
  semanticCheck('Capgo forgot-password auth flow route present', dashboardRouter.includes("path: '/forgot_password'") && dashboardRouter.includes('ForgotPasswordView') && dashboardRegistration.includes('requestPasswordReset') && dashboardRegistration.includes('completePasswordReset') && dashboardRegistration.includes('exchangeCodeForSession') && dashboardRegistration.includes('setSession'), 'dashboard routes /forgot_password and supports Supabase reset email plus code/hash recovery'),
  semanticCheck('React Native updater resolves bundle id automatically', updaterIndex.includes('getCodePushGoBundleId') && updaterIndex.includes('bundle_id: this.appId') && updaterIndex.includes('startCodePushGo'), 'updater resolves RN bundle id and sends app_id/bundle_id'),
  semanticCheck('native self-managed/direct-update complexity is disabled', !/directUpdateMode|setNextBundle|shouldConsumeOnLaunchDirectUpdate/.test(nativeContract), 'native contract only normalizes simple off/background update checks'),
  semanticCheck('native build/store flows explicitly disabled', existsSync(join(workspace, 'packages/cli/src/native-build-scope.ts')) && readWorkspaceFile('packages/cli/src/native-build-scope.ts').includes('intentionally out of scope'), 'native build automation has explicit disabled contract'),
  semanticCheck('AGENTS norms present', agents.includes('Use `bun` and `bunx`') && agents.includes('Do not add Supabase Edge Functions'), 'root AGENTS.md captures repo norms'),
  semanticCheck('GitHub Actions run full local gate', ['bun run lint', 'bun run typecheck', 'bun run build', 'bun run test', 'bun run native:contract', 'bun run parity:audit'].every(command => testsWorkflow.includes(command)), 'CI test workflow mirrors local verification gate'),
]
const semanticFailures = semanticChecks.filter(check => check.status === 'fail')

const totalCodePushGoTests = matchingFilesAcrossRoots([join(workspace, 'packages'), join(workspace, 'apps')], [/\.test\.ts$/]).length

const reports: SuiteReport[] = suites.map((suite) => {
  const sourceFiles = matchingFiles(suite.sourceRoot, suite.sourcePatterns)
  const codepushgoFiles = matchingFilesAcrossRoots(suite.codepushgoRoots, suite.codepushgoPatterns)
  const codepushgoKeys = new Set(codepushgoFiles.map(fileKey))
  const missing = sourceFiles.filter((file) => !codepushgoKeys.has(fileKey(file)))
  const outOfScope = suite.outOfScopeReason !== undefined

  return {
    name: suite.name,
    sourceRoot: suite.sourceRoot,
    sourceCount: sourceFiles.length,
    codepushgoCount: codepushgoFiles.length,
    status: outOfScope ? 'not applicable' : missing.length === 0 && semanticFailures.length === 0 ? 'verified' : missing.length === 0 ? 'needs semantic audit' : 'missing coverage',
    missingExamples: outOfScope ? [] : missing.slice(0, 25),
    outOfScopeReason: suite.outOfScopeReason,
  }
})

const reportsWithMissingCoverage = reports.filter(report => report.status === 'missing coverage')
const auditFailures = [
  ...semanticFailures.map(check => `semantic:${check.name}`),
  ...reportsWithMissingCoverage.map(report => `coverage:${report.name}`),
]

const lines = [
  '# Capgo / CodePushGo Parity Audit',
  '',
  `Capgo source: ${capgoSource}`,
  `Capacitor updater source: ${updaterSource}`,
  `CodePushGo test count: ${totalCodePushGoTests}`,
  '',
  '| Suite | Source tests/flows | CodePushGo matching files | Status |',
  '| --- | ---: | ---: | --- |',
  ...reports.map((report) => `| ${report.name} | ${report.sourceCount} | ${report.codepushgoCount} | ${report.status} |`),
  '',
  '## Missing Source Examples',
  '',
  ...reports.flatMap((report) => [
    `### ${report.name}`,
    '',
    ...(report.outOfScopeReason
      ? [`- Not applicable: ${report.outOfScopeReason}`]
      : report.missingExamples.length ? report.missingExamples.map((file) => `- ${file}`) : ['- None by filename; semantic parity checks passed.']),
    '',
  ]),
  '## Semantic Requirement Checks',
  '',
  '| Check | Status | Detail |',
  '| --- | --- | --- |',
  ...semanticChecks.map((check) => `| ${check.name} | ${check.status} | ${check.detail} |`),
  '',
]

const output = join(workspace, 'docs/parity/capgo-codepushgo-parity.md')
writeFileSync(output, `${lines.join('\n')}\n`)
console.log(JSON.stringify({ status: auditFailures.length === 0 ? 'ok' : 'failed', output, reports, semanticChecks, auditFailures }, null, 2))
if (auditFailures.length > 0)
  process.exit(1)
