import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface SemanticCheck {
  name: string
  status: 'pass' | 'fail'
  detail: string
}

const workspace = process.cwd()

function readWorkspaceFile(path: string) {
  return readFileSync(join(workspace, path), 'utf8')
}

function hasFile(path: string) {
  return existsSync(join(workspace, path))
}

function semanticCheck(name: string, ok: boolean, detail: string): SemanticCheck {
  return { name, status: ok ? 'pass' : 'fail', detail }
}

const packageJson = JSON.parse(readWorkspaceFile('package.json')) as { workspaces?: string[], scripts?: Record<string, string> }
const dashboardPackage = JSON.parse(readWorkspaceFile('apps/dashboard/package.json')) as { dependencies?: Record<string, string> }
const dashboardConfig = readWorkspaceFile('apps/dashboard/configs.json')
const dashboardWrangler = readWorkspaceFile('apps/dashboard/wrangler.toml')
const deployWorkflow = readWorkspaceFile('.github/workflows/deploy_worker.yml')
const testsWorkflow = readWorkspaceFile('.github/workflows/tests.yml')
const agents = readWorkspaceFile('AGENTS.md')
const migration = readWorkspaceFile('supabase/migrations/20260611111318_codepushgo_init.sql')
const workerIndex = readWorkspaceFile('packages/worker/src/index.ts')
const updaterIndex = readWorkspaceFile('packages/react-native-updater/src/index.ts')
const appPages = readdirSync(join(workspace, 'apps/dashboard/src/pages'))

const semanticChecks: SemanticCheck[] = [
  semanticCheck('monorepo packages present', ['apps/*', 'packages/*', 'apps/dashboard/cli'].every(item => packageJson.workspaces?.includes(item)), 'root workspaces include apps, packages, and copied Capgo dashboard CLI workspace'),
  semanticCheck('Capgo file-router console copied', hasFile('apps/dashboard/src/pages/login.vue') && hasFile('apps/dashboard/src/pages/register.vue') && hasFile('apps/dashboard/src/pages/dashboard.vue') && hasFile('apps/dashboard/src/pages/app/[app].bundle.[bundle].vue') && appPages.includes('settings'), 'dashboard uses the copied Capgo Vue file-based console pages'),
  semanticCheck('Vue dashboard remains Vue 3', !!dashboardPackage.dependencies?.vue && hasFile('apps/dashboard/src/App.vue') && hasFile('apps/dashboard/vite.config.mts'), 'dashboard package uses Vue and copied Vite config'),
  semanticCheck('CodePushGo Supabase public config present', dashboardConfig.includes('https://umpxowxnwroafuzynvwf.supabase.co') && dashboardConfig.includes('sb_publishable__EBHKsRnL--XAzmI7NWRww_q531-pQO'), 'dashboard public config points at the CodePushGo Supabase project'),
  semanticCheck('console custom domain deploy configured', dashboardWrangler.includes('console.codepushgo.com') && deployWorkflow.includes('wrangler deploy --config apps/dashboard/wrangler.toml'), 'console Worker assets deploy to the CodePushGo console domain'),
  semanticCheck('Cloudflare Worker backend is configured', hasFile('packages/worker/wrangler.toml') && packageJson.scripts?.['worker:dev']?.includes('wrangler dev') && packageJson.scripts?.['worker:deploy']?.includes('wrangler deploy'), 'wrangler.toml and worker scripts are present'),
  semanticCheck('no Supabase Edge Functions', !existsSync(join(workspace, 'supabase/functions')) && !deployWorkflow.includes('supabase functions deploy') && !/functions\/v1|supabase\/functions/.test(workerIndex), 'repo uses the consolidated migration and Cloudflare Worker runtime instead of Supabase Edge Functions'),
  semanticCheck('consolidated migration contains onboarding and plan intent', migration.includes('CREATE TABLE IF NOT EXISTS public.plan_intents') && migration.includes('CREATE OR REPLACE FUNCTION public.create_organization_onboarding') && migration.includes('CREATE OR REPLACE FUNCTION public.create_app_onboarding'), 'Supabase schema has onboarding RPCs and plan intent table'),
  semanticCheck('React Native updater resolves bundle id automatically', updaterIndex.includes('getCodePushGoBundleId') && updaterIndex.includes('bundle_id: this.appId') && updaterIndex.includes('startCodePushGo'), 'updater resolves RN bundle id and sends app_id/bundle_id'),
  semanticCheck('AGENTS norms present', agents.includes('Use `bun` and `bunx`') && agents.includes('Do not add Supabase Edge Functions'), 'root AGENTS.md captures repo norms'),
  semanticCheck('GitHub Actions run full local gate', ['bun run lint', 'bun run typecheck', 'bun run build', 'bun run test', 'bun run native:contract', 'bun run parity:audit'].every(command => testsWorkflow.includes(command)), 'CI test workflow mirrors local verification gate'),
]

const semanticFailures = semanticChecks.filter(check => check.status === 'fail')
const lines = [
  '# Capgo / CodePushGo Parity Audit',
  '',
  'This audit tracks the copied Capgo console/backend structure adapted for CodePushGo React Native.',
  '',
  '| Check | Status | Detail |',
  '| --- | --- | --- |',
  ...semanticChecks.map(check => `| ${check.name} | ${check.status} | ${check.detail} |`),
  '',
]

const output = join(workspace, 'docs/parity/capgo-codepushgo-parity.md')
writeFileSync(output, `${lines.join('\n')}\n`)
console.log(JSON.stringify({ status: semanticFailures.length === 0 ? 'ok' : 'failed', output, semanticChecks, auditFailures: semanticFailures.map(check => `semantic:${check.name}`) }, null, 2))
if (semanticFailures.length > 0)
  process.exit(1)
