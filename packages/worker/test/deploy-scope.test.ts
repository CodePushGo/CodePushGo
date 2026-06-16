import { describe, expect, it } from 'vitest'
import { resolveDeployScopeFromFiles, resolveDeployScopeFromGit } from '../../../scripts/deploy-scope'

const noDeploys = {
  dashboard: false,
  docs: false,
  migrations: false,
  packages: false,
  worker: false,
}

describe('[Capgo parity] deploy scope matching', () => {
  it.concurrent('does not deploy runtime targets for docs-only changes', () => {
    expect(resolveDeployScopeFromFiles(['docs/parity/capgo-codepushgo-parity.md'])).toEqual({
      ...noDeploys,
      docs: true,
    })
  })

  it.concurrent('deploys dashboard only for Vue dashboard changes', () => {
    expect(resolveDeployScopeFromFiles(['apps/dashboard/src/App.vue'])).toEqual({
      ...noDeploys,
      dashboard: true,
    })
  })

  it.concurrent('deploys Worker for Worker runtime changes', () => {
    expect(resolveDeployScopeFromFiles(['packages/worker/src/index.ts'])).toEqual({
      ...noDeploys,
      worker: true,
    })
  })

  it.concurrent('deploys packages for CLI and React Native updater package changes', () => {
    expect(resolveDeployScopeFromFiles(['packages/cli/src/index.ts', 'packages/react-native-updater/src/index.ts'])).toEqual({
      ...noDeploys,
      packages: true,
    })
  })

  it.concurrent('deploys Worker, dashboard, and packages when shared contracts change', () => {
    expect(resolveDeployScopeFromFiles(['packages/shared/src/index.ts'])).toEqual({
      ...noDeploys,
      dashboard: true,
      packages: true,
      worker: true,
    })
  })

  it.concurrent('deploys Worker and migrations for consolidated schema changes', () => {
    expect(resolveDeployScopeFromFiles(['supabase/migrations/20260611111318_codepushgo_init.sql'])).toEqual({
      ...noDeploys,
      migrations: true,
      worker: true,
    })
  })

  it.concurrent('deploys all build surfaces for root dependency changes', () => {
    expect(resolveDeployScopeFromFiles(['package.json'])).toEqual({
      ...noDeploys,
      dashboard: true,
      packages: true,
      worker: true,
    })
  })

  it.concurrent('ignores generated release commits when resolving changed code', () => {
    const run = (args: string[]) => {
      const key = args.join(' ')
      const responses: Record<string, string> = {
        'log -1 --format=%s codepushgo-12.0.0': 'chore(release): 12.0.0',
        'rev-parse codepushgo-12.0.0^': 'feature-head',
        'describe --tags --match codepushgo-[0-9]* --exclude codepushgo-*-alpha* --abbrev=0 feature-head': 'codepushgo-11.0.0',
        'diff --name-only --diff-filter=ACMRTD codepushgo-11.0.0..feature-head': 'apps/dashboard/src/App.vue',
      }
      if (key in responses)
        return responses[key]
      throw new Error(`Unexpected git call: ${key}`)
    }

    expect(resolveDeployScopeFromGit('codepushgo-12.0.0', run)).toEqual({
      base: 'codepushgo-11.0.0',
      files: ['apps/dashboard/src/App.vue'],
      head: 'feature-head',
      scope: {
        ...noDeploys,
        dashboard: true,
      },
    })
  })

  it.concurrent('excludes alpha tags when resolving production deploy scope', () => {
    const run = (args: string[]) => {
      const key = args.join(' ')
      const responses: Record<string, string> = {
        'log -1 --format=%s codepushgo-12.0.0': 'chore(release): 12.0.0',
        'rev-parse codepushgo-12.0.0^': 'feature-head',
        'describe --tags --match codepushgo-[0-9]* --exclude codepushgo-*-alpha* --abbrev=0 feature-head': 'codepushgo-11.0.0',
        'diff --name-only --diff-filter=ACMRTD codepushgo-11.0.0..feature-head': 'packages/worker/src/index.ts',
      }
      if (key in responses)
        return responses[key]
      throw new Error(`Unexpected git call: ${key}`)
    }

    expect(resolveDeployScopeFromGit('codepushgo-12.0.0', run)).toEqual({
      base: 'codepushgo-11.0.0',
      files: ['packages/worker/src/index.ts'],
      head: 'feature-head',
      scope: {
        ...noDeploys,
        worker: true,
      },
    })
  })

  it.concurrent('includes alpha tags when resolving alpha deploy scope', () => {
    const run = (args: string[]) => {
      const key = args.join(' ')
      const responses: Record<string, string> = {
        'log -1 --format=%s codepushgo-12.0.0-alpha.1': 'chore(release): 12.0.0-alpha.1',
        'rev-parse codepushgo-12.0.0-alpha.1^': 'feature-head',
        'describe --tags --match codepushgo-[0-9]* --abbrev=0 feature-head': 'codepushgo-11.0.0-alpha.9',
        'diff --name-only --diff-filter=ACMRTD codepushgo-11.0.0-alpha.9..feature-head': 'packages/cli/src/index.ts',
      }
      if (key in responses)
        return responses[key]
      throw new Error(`Unexpected git call: ${key}`)
    }

    expect(resolveDeployScopeFromGit('codepushgo-12.0.0-alpha.1', run)).toEqual({
      base: 'codepushgo-11.0.0-alpha.9',
      files: ['packages/cli/src/index.ts'],
      head: 'feature-head',
      scope: {
        ...noDeploys,
        packages: true,
      },
    })
  })

  it.concurrent('deploys all targets when no previous CodePushGo tag exists', () => {
    const run = (args: string[]) => {
      const key = args.join(' ')
      if (key === 'log -1 --format=%s HEAD')
        return 'feat: first codepushgo release'
      if (key === 'describe --tags --match codepushgo-[0-9]* --exclude codepushgo-*-alpha* --abbrev=0 HEAD') {
        throw Object.assign(new Error('git describe failed'), {
          stderr: 'fatal: No names found, cannot describe anything.',
        })
      }
      throw new Error(`Unexpected git call: ${key}`)
    }

    expect(resolveDeployScopeFromGit('HEAD', run)).toEqual({
      base: null,
      files: [],
      head: 'HEAD',
      scope: {
        dashboard: true,
        docs: true,
        migrations: true,
        packages: true,
        worker: true,
      },
    })
  })
})
