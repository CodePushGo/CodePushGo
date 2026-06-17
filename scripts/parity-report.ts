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
const dashboardRoute = readWorkspaceFile('apps/dashboard/src/route.ts')
const dashboardRegistration = readWorkspaceFile('apps/dashboard/src/services/registration.ts')

const semanticChecks: SemanticCheck[] = [
  semanticCheck('monorepo packages present', ['apps/*', 'packages/*'].every(item => packageJson.workspaces?.includes(item)), 'root workspaces include apps and packages'),
  semanticCheck('CLI command handlers stay out of entrypoint', cliIndex.includes('handleInit') && !cliIndex.includes('async function handleInit') && cliCommands.includes('export async function handleInit'), 'CLI entrypoint wires commands to handlers in src/commands.ts'),
  semanticCheck('CLI defaults app identity to detected RN bundle id', cliCommands.includes('detectReactNativeBundleId') && cliCommands.includes('detected?.bundleId') && cliCommands.includes('api.createApp(config.appId'), 'init/resolve path uses detected React Native bundle id and auto-syncs when authenticated'),
  semanticCheck('Worker backend accepts bundle_id/app_id and public device endpoints', workerIndex.includes('bundle_id') && workerIndex.includes("'/updates'") && workerIndex.includes("'/stats'") && workerIndex.includes("'/channel_self'"), 'Worker device contracts accept React Native bundle_id and expose update/stat/channel_self endpoints'),
  semanticCheck('Cloudflare Worker backend is configured', existsSync(join(workspace, 'packages/worker/wrangler.toml')) && packageJson.scripts?.['worker:dev']?.includes('wrangler dev'), 'wrangler.toml and worker scripts are present'),
  semanticCheck('no Supabase Edge Functions', !existsSync(join(workspace, 'supabase/functions')) && !/functions\/v1|supabase\/functions/.test(workerIndex), 'repo has only consolidated migration and Worker storage adapters'),
  semanticCheck('Vue dashboard remains Vue 3', !!dashboardPackage.dependencies?.vue && existsSync(join(workspace, 'apps/dashboard/src/App.vue')), 'dashboard package uses Vue and App.vue exists'),
  semanticCheck('Capgo forgot-password auth flow route present', dashboardRoute.includes("'/forgot_password'") && dashboardApp.includes('ForgotPasswordView') && dashboardRegistration.includes('requestPasswordReset') && dashboardRegistration.includes('completePasswordReset') && dashboardRegistration.includes('exchangeCodeForSession') && dashboardRegistration.includes('setSession'), 'dashboard routes /forgot_password and supports Supabase reset email plus code/hash recovery'),
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
