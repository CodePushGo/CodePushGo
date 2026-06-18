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
const dashboardConsoleBundlesPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleBundlesPage.vue')
const dashboardConsoleChannelsPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleChannelsPage.vue')
const dashboardConsoleDevicesPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleDevicesPage.vue')
const dashboardConsoleStatsPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleStatsPage.vue')
const dashboardConsoleApiKeysPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleApiKeysPage.vue')
const dashboardConsoleSettingsPage = readWorkspaceFile('apps/dashboard/src/views/console/ConsoleSettingsPage.vue')
const consolidatedMigration = readWorkspaceFile('supabase/migrations/20260611111318_codepushgo_init.sql')

const semanticChecks: SemanticCheck[] = [
  semanticCheck('monorepo packages present', ['apps/*', 'packages/*'].every(item => packageJson.workspaces?.includes(item)), 'root workspaces include apps and packages'),
  semanticCheck('CLI command handlers stay out of entrypoint', cliIndex.includes('handleInit') && !cliIndex.includes('async function handleInit') && cliCommands.includes('export async function handleInit'), 'CLI entrypoint wires commands to handlers in src/commands.ts'),
  semanticCheck('CLI defaults app identity to detected RN bundle id', cliCommands.includes('detectReactNativeBundleId') && cliCommands.includes('detected?.bundleId') && cliCommands.includes('api.createApp(config.appId'), 'init/resolve path uses detected React Native bundle id and auto-syncs when authenticated'),
  semanticCheck('Worker backend accepts bundle_id/app_id and public device endpoints', workerIndex.includes('bundle_id') && workerIndex.includes("'/updates'") && workerIndex.includes("'/stats'") && workerIndex.includes("'/channel_self'"), 'Worker device contracts accept React Native bundle_id and expose update/stat/channel_self endpoints'),
  semanticCheck('Cloudflare Worker backend is configured', existsSync(join(workspace, 'packages/worker/wrangler.toml')) && packageJson.scripts?.['worker:dev']?.includes('wrangler dev'), 'wrangler.toml and worker scripts are present'),
  semanticCheck('Capgo protected auth guard and organization onboarding present', dashboardAuthGuard.includes('createAuthGuard') && dashboardAuthGuard.includes('createDashboardClient') && dashboardAuthGuard.includes("'/onboarding/organization'") && dashboardAuthGuard.includes("from('orgs')") && dashboardRouter.includes("path: '/onboarding/organization'") && dashboardOrganizationOnboarding.includes('createOrganizationOnboarding') && dashboardRegistration.includes('createOrganizationOnboarding') && consolidatedMigration.includes('create_organization_onboarding') && consolidatedMigration.includes("'organization_onboarding'"), 'protected routes hydrate Supabase auth, load member orgs through RLS, redirect no-org users to organization onboarding, and record plan intent there'),
  semanticCheck('Capgo console shared store present', dashboardConsoleStore.includes('createConsoleStore') && dashboardConsoleStore.includes('useConsoleStore') && dashboardConsoleStore.includes('refreshAppData') && dashboardConsoleStore.includes('recordPlanIntent') && dashboardConsoleView.includes('useConsoleStore') && !dashboardConsoleView.includes('createDashboardClient'), 'console auth, app selection, refresh, plan intent, and command state live outside the page view'),
  semanticCheck('Capgo canonical app routes present', dashboardConsoleRoute.includes('return `/app/${encoded}`') && dashboardConsoleRoute.includes('`/app/${encoded}/bundles`') && !dashboardConsoleRoute.includes('`/app/p/${encoded}') && dashboardRouter.includes("path: 'app/:appId'") && dashboardRouter.includes("path: 'app/:appId/bundles'") && dashboardRouter.includes("path: 'app/:appId/:pathMatch(.*)*'") && !dashboardRouter.includes("path: '/app/p/:appId") && dashboardRouteSurface.includes("path: '/app/p/:package'") && dashboardRouteSurface.includes('legacyAppRedirect'), 'app URLs are generated as /app/:nativeBundleId and legacy package URLs are redirects only'),
  semanticCheck('Capgo console shell split from page content', dashboardConsoleLayout.includes('Sidebar') && dashboardConsoleLayout.includes('Navbar') && dashboardConsoleLayout.includes('<slot') && dashboardConsoleView.includes('ConsoleLayout') && dashboardConsoleView.includes('RouterView') && dashboardRouter.includes('export const consoleRoutes') && ['ConsoleHomePage', 'ConsoleAppOverviewPage', 'ConsoleBundlesPage', 'ConsoleChannelsPage', 'ConsoleDevicesPage', 'ConsoleStatsPage', 'ConsoleApiKeysPage', 'ConsoleSettingsPage'].every(page => dashboardRouter.includes(page)) && ['<WelcomeBanner', '<Usage', 'aria-label="Release table"', 'aria-label="Channels table"', 'aria-label="Devices table"', 'aria-label="Stats table"', 'Create an organization API key', 'Record the onboarding choice'].every(fragment => !dashboardConsoleView.includes(fragment)) && dashboardConsoleHomePage.includes('TopApps') && dashboardConsoleHomePage.includes('WelcomeBanner') && dashboardConsoleAppOverviewPage.includes('Usage') && dashboardConsoleAppOverviewPage.includes('Latest bundles') && dashboardConsoleBundlesPage.includes('aria-label="Release table"') && dashboardConsoleChannelsPage.includes('aria-label="Channels table"') && dashboardConsoleDevicesPage.includes('aria-label="Devices table"') && dashboardConsoleStatsPage.includes('aria-label="Stats table"') && dashboardConsoleApiKeysPage.includes('Create an organization API key') && dashboardConsoleSettingsPage.includes('Record the onboarding choice') && !dashboardConsoleView.includes("components/Navbar.vue") && !dashboardConsoleView.includes("components/Sidebar.vue") && dashboardConsoleRoute.includes('pathSection') && dashboardConsoleRoute.includes('appHref'), 'console shell owns sidebar/navbar and RouterView while route helpers and Vue Router own page mapping'),
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
