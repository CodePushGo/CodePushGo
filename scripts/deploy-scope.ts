import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { TextDecoder } from 'node:util'

export type DeployTarget = 'worker' | 'dashboard' | 'migrations' | 'packages' | 'docs'
export type DeployScope = Record<DeployTarget, boolean>
type GitRunner = (args: string[]) => string

export interface DeployScopeResult {
  base: string | null
  files: string[]
  head: string
  scope: DeployScope
}

const deployTargets = ['worker', 'dashboard', 'migrations', 'packages', 'docs'] as const satisfies readonly DeployTarget[]

const packageDependencyMatchers = [
  /^package\.json$/,
  /^bun\.lock$/,
  /^tsconfig\.base\.json$/,
  /^vitest\.config\.ts$/,
]

export const deployMatchers: Record<DeployTarget, RegExp[]> = {
  worker: [
    ...packageDependencyMatchers,
    /^packages\/worker\//,
    /^packages\/shared\//,
    /^supabase\/migrations\//,
    /^scripts\/deploy-scope\.ts$/,
    /^\.github\/workflows\/(deploy_worker|tests)\.ya?ml$/,
  ],
  dashboard: [
    ...packageDependencyMatchers,
    /^apps\/dashboard\//,
    /^packages\/shared\//,
  ],
  migrations: [
    /^supabase\/migrations\//,
  ],
  packages: [
    ...packageDependencyMatchers,
    /^packages\/cli\//,
    /^packages\/react-native-updater\//,
    /^packages\/shared\//,
  ],
  docs: [
    /^README\.md$/,
    /^AGENTS\.md$/,
    /^docs\//,
  ],
}

function runGit(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function stringifyGitErrorOutput(value: unknown): string {
  if (typeof value === 'string')
    return value
  if (value instanceof Uint8Array)
    return new TextDecoder().decode(value)
  return ''
}

function getGitErrorText(error: unknown): string {
  const parts: string[] = []
  if (error instanceof Error)
    parts.push(error.message)
  if (typeof error === 'object' && error !== null) {
    const outputs = error as { stdout?: unknown, stderr?: unknown }
    parts.push(stringifyGitErrorOutput(outputs.stdout))
    parts.push(stringifyGitErrorOutput(outputs.stderr))
  }
  return parts.filter(Boolean).join('\n')
}

function isNoMatchingTagError(error: unknown): boolean {
  return /no matching tag|no names found|no tags can describe|fatal: no tag/i.test(getGitErrorText(error))
}

function allTargets(value: boolean): DeployScope {
  return deployTargets.reduce((scope, target) => {
    scope[target] = value
    return scope
  }, {} as DeployScope)
}

export function matchesDeployTarget(target: DeployTarget, files: string[]): boolean {
  return files.some(file => deployMatchers[target].some(pattern => pattern.test(file)))
}

export function resolveDeployScopeFromFiles(files: string[]): DeployScope {
  return deployTargets.reduce((scope, target) => {
    scope[target] = matchesDeployTarget(target, files)
    return scope
  }, {} as DeployScope)
}

export function getComparableDeployHead(after: string, run: GitRunner = runGit): string {
  const subject = run(['log', '-1', '--format=%s', after])
  if (!subject.startsWith('chore(release):'))
    return after

  try {
    return run(['rev-parse', `${after}^`])
  }
  catch {
    return after
  }
}

export function isAlphaDeployRef(after: string, run: GitRunner = runGit): boolean {
  if (after.includes('-alpha'))
    return true
  return run(['log', '-1', '--format=%s', after]).includes('-alpha')
}

export function getPreviousCodePushGoTag(head: string, includePrereleaseTags: boolean, run: GitRunner = runGit): string | null {
  try {
    const args = ['describe', '--tags', '--match', 'codepushgo-[0-9]*']
    if (!includePrereleaseTags)
      args.push('--exclude', 'codepushgo-*-alpha*')
    args.push('--abbrev=0', head)

    const tag = run(args)
    return tag || null
  }
  catch (error) {
    if (!isNoMatchingTagError(error))
      throw error
    return null
  }
}

function getChangedFiles(base: string, head: string, run: GitRunner = runGit): string[] {
  const files = run(['diff', '--name-only', '--diff-filter=ACMRTD', `${base}..${head}`])
  return files ? files.split('\n').filter(Boolean) : []
}

export function resolveDeployScopeFromGit(after = 'HEAD', run: GitRunner = runGit): DeployScopeResult {
  const includePrereleaseTags = isAlphaDeployRef(after, run)
  const head = getComparableDeployHead(after, run)
  const base = getPreviousCodePushGoTag(head, includePrereleaseTags, run)

  if (!base) {
    return {
      base: null,
      files: [],
      head,
      scope: allTargets(true),
    }
  }

  const files = getChangedFiles(base, head, run)
  return {
    base,
    files,
    head,
    scope: resolveDeployScopeFromFiles(files),
  }
}

if (import.meta.main) {
  const result = resolveDeployScopeFromGit(process.argv[2] ?? 'HEAD')

  console.error(`Deploy scope base: ${result.base ?? '<none>'}`)
  console.error(`Deploy scope head: ${result.head}`)
  console.error(`Deploy scope changed files: ${result.files.length}`)
  for (const file of result.files)
    console.error(`- ${file}`)

  for (const target of deployTargets)
    console.log(`${target}=${result.scope[target]}`)
}
