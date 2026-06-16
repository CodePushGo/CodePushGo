import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { TextDecoder } from 'node:util'

export type Component = 'codepushgo' | 'cli'
export type ReleaseAs = 'patch' | 'minor' | 'major'
type GitRunner = (args: string[]) => string

const sharedMatchers = [
  /^\.github\/workflows\/tests\.ya?ml$/,
  /^\.github\/scripts\//,
  /^scripts\/release-scope\.ts$/,
  /^scripts\/setup-bun\.sh$/,
  /^package\.json$/,
  /^bun\.lock$/,
  /^tsconfig\.base\.json$/,
  /^vitest\.config\.ts$/,
]

export const componentMatchers: Record<Component, RegExp[]> = {
  codepushgo: [
    ...sharedMatchers,
    /^\.github\/workflows\/deploy_worker\.ya?ml$/,
    /^scripts\/deploy-scope\.ts$/,
    /^apps\/dashboard\//,
    /^packages\/worker\//,
    /^packages\/react-native-updater\//,
    /^packages\/shared\//,
    /^supabase\//,
    /^native-contract-tests\//,
    /^docs\//,
    /^README\.md$/,
    /^AGENTS\.md$/,
  ],
  cli: [
    ...sharedMatchers,
    /^\.github\/workflows\/publish_cli\.ya?ml$/,
    /^packages\/cli\//,
    /^packages\/shared\//,
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

export function getComponentTagPattern(component: Component): string {
  return component === 'codepushgo' ? 'codepushgo-[0-9]*' : 'cli-[0-9]*'
}

export function getLatestComponentTag(component: Component, after: string, run: GitRunner = runGit): string | null {
  try {
    const tag = run(['describe', '--tags', '--match', getComponentTagPattern(component), '--abbrev=0', after])
    return tag || null
  }
  catch (error) {
    if (!isNoMatchingTagError(error))
      throw error
    return null
  }
}

export function getReleaseRangeBase(component: Component, before: string, after: string, run: GitRunner = runGit): string {
  return getLatestComponentTag(component, after, run) ?? before
}

function getCommitShas(before: string, after: string, run: GitRunner = runGit): string[] {
  const isZero = before === '' || /^0+$/.test(before)
  if (!isZero) {
    const commits = run(['rev-list', '--reverse', `${before}..${after}`])
    return commits ? commits.split('\n').filter(Boolean) : []
  }

  const parents = run(['rev-list', '--parents', '-n', '1', after]).split(' ')
  if (parents.length > 1) {
    const commits = run(['rev-list', '--reverse', `${after}^..${after}`])
    return commits ? commits.split('\n').filter(Boolean) : []
  }

  return [after]
}

function getChangedFiles(commit: string, run: GitRunner = runGit): string[] {
  const files = run(['show', '--format=', '--name-only', commit])
  return files ? files.split('\n').filter(Boolean) : []
}

function getCommitMessage(commit: string, run: GitRunner = runGit): { subject: string, body: string } {
  return {
    subject: run(['log', '-1', '--format=%s', commit]),
    body: run(['log', '-1', '--format=%b', commit]),
  }
}

export function matchesComponent(component: Component, files: string[]): boolean {
  return files.some(file => componentMatchers[component].some(pattern => pattern.test(file)))
}

export function getSeverity(subject: string, body: string): number {
  const conventionalMatch = subject.match(/^([a-z]+)(\([^)]+\))?(!)?:/)
  const hasBreakingChange = body.includes('BREAKING CHANGE:') || conventionalMatch?.[3] === '!'
  if (hasBreakingChange)
    return 3
  if (conventionalMatch?.[1] === 'feat')
    return 2
  return 1
}

export function toReleaseAs(severity: number): ReleaseAs {
  if (severity >= 3)
    return 'major'
  if (severity === 2)
    return 'minor'
  return 'patch'
}

export function resolveReleaseScope(component: Component, before: string, after: string, run: GitRunner = runGit) {
  const releaseBase = getReleaseRangeBase(component, before, after, run)
  const commits = getCommitShas(releaseBase, after, run)
  let shouldRelease = false
  let highestSeverity = 0

  for (const commit of commits) {
    const files = getChangedFiles(commit, run)
    if (!matchesComponent(component, files))
      continue

    shouldRelease = true
    const message = getCommitMessage(commit, run)
    highestSeverity = Math.max(highestSeverity, getSeverity(message.subject, message.body))
  }

  return {
    shouldRelease,
    releaseAs: shouldRelease ? toReleaseAs(highestSeverity) : 'patch',
  }
}

if (import.meta.main) {
  const componentArg = process.argv[2]
  const before = process.argv[3] ?? ''
  const after = process.argv[4] ?? 'HEAD'

  if (componentArg !== 'codepushgo' && componentArg !== 'cli') {
    console.error('Usage: bun scripts/release-scope.ts <codepushgo|cli> [before] [after]')
    process.exit(1)
  }

  const scope = resolveReleaseScope(componentArg, before, after)
  console.log(`should_release=${scope.shouldRelease}`)
  console.log(`release_as=${scope.releaseAs}`)
}
