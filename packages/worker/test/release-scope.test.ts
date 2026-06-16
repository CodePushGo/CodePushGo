import { describe, expect, it } from 'vitest'
import { getReleaseRangeBase, matchesComponent, resolveReleaseScope } from '../../../scripts/release-scope'

describe('[Capgo parity] release scope matching', () => {
  it.concurrent('treats shared release infrastructure as affecting both components', () => {
    const files = [
      '.github/workflows/tests.yml',
      '.github/scripts/start-background-service.sh',
      'scripts/setup-bun.sh',
      'scripts/release-scope.ts',
    ]

    expect(matchesComponent('codepushgo', files)).toBe(true)
    expect(matchesComponent('cli', files)).toBe(true)
  })

  it.concurrent('treats worker deploy workflow changes as app-only releases', () => {
    const files = ['.github/workflows/deploy_worker.yml', 'scripts/deploy-scope.ts']

    expect(matchesComponent('codepushgo', files)).toBe(true)
    expect(matchesComponent('cli', files)).toBe(false)
  })

  it.concurrent('treats cli publish workflow changes as cli-only releases', () => {
    const files = ['.github/workflows/publish_cli.yml']

    expect(matchesComponent('codepushgo', files)).toBe(false)
    expect(matchesComponent('cli', files)).toBe(true)
  })

  it.concurrent('keeps runtime code scoped to the matching component', () => {
    expect(matchesComponent('codepushgo', ['apps/dashboard/src/App.vue'])).toBe(true)
    expect(matchesComponent('cli', ['apps/dashboard/src/App.vue'])).toBe(false)
    expect(matchesComponent('codepushgo', ['packages/cli/src/index.ts'])).toBe(false)
    expect(matchesComponent('cli', ['packages/cli/src/index.ts'])).toBe(true)
  })

  it.concurrent('does not release on unrelated changes', () => {
    const files = ['.editorconfig']

    expect(matchesComponent('codepushgo', files)).toBe(false)
    expect(matchesComponent('cli', files)).toBe(false)
  })

  it.concurrent('uses the latest component tag instead of only the pushed range', () => {
    const run = (args: string[]) => {
      if (args[0] === 'describe') {
        expect(args).toEqual(['describe', '--tags', '--match', 'cli-[0-9]*', '--abbrev=0', 'HEAD'])
        return 'cli-0.1.5'
      }

      throw new Error(`Unexpected git call: ${args.join(' ')}`)
    }

    expect(getReleaseRangeBase('cli', 'previous-push-sha', 'HEAD', run)).toBe('cli-0.1.5')
  })

  it.concurrent('falls back to the pushed range when no component tag exists', () => {
    const run = (args: string[]) => {
      if (args[0] === 'describe') {
        throw Object.assign(new Error('git describe failed'), {
          stderr: 'fatal: No names found, cannot describe anything.',
        })
      }

      throw new Error(`Unexpected git call: ${args.join(' ')}`)
    }

    expect(getReleaseRangeBase('codepushgo', 'previous-push-sha', 'HEAD', run)).toBe('previous-push-sha')
  })

  it.concurrent('rethrows unexpected git describe failures', () => {
    const run = (args: string[]) => {
      if (args[0] === 'describe')
        throw new Error('fatal: bad revision HEAD')

      throw new Error(`Unexpected git call: ${args.join(' ')}`)
    }

    expect(() => getReleaseRangeBase('cli', 'previous-push-sha', 'HEAD', run)).toThrow('fatal: bad revision HEAD')
  })

  it.concurrent('keeps missed CLI changes releasable after a later app-only push', () => {
    const run = (args: string[]) => {
      const key = args.join(' ')
      const responses: Record<string, string> = {
        'describe --tags --match cli-[0-9]* --abbrev=0 head-app-only': 'cli-0.1.5',
        'rev-list --reverse cli-0.1.5..head-app-only': 'cli-change\napp-change',
        'show --format= --name-only cli-change': 'packages/cli/src/upload.ts',
        'show --format= --name-only app-change': 'apps/dashboard/src/App.vue',
        'log -1 --format=%s cli-change': 'feat(cli): upload React Native bundle',
        'log -1 --format=%b cli-change': '',
      }

      if (key in responses)
        return responses[key]

      throw new Error(`Unexpected git call: ${key}`)
    }

    expect(resolveReleaseScope('cli', 'app-change-parent', 'head-app-only', run)).toEqual({
      shouldRelease: true,
      releaseAs: 'minor',
    })
  })
})
