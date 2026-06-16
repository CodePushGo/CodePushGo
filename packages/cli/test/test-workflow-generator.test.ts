import { describe, expect, it } from 'vitest'
import { generateWorkflow, WORKFLOW_PATH } from '../src/workflow'

describe('[Capgo parity] GitHub Actions workflow generator', () => {
  it('writes the CodePushGo workflow path and bun commands', () => {
    const result = generateWorkflow({ appId: 'com.example.app', platform: 'ios', packageManager: 'bun', buildScript: { type: 'npm-script', name: 'build' } })
    expect(result.path).toBe(WORKFLOW_PATH)
    expect(result.content).toContain('oven-sh/setup-bun@v2')
    expect(result.content).toContain('actions/setup-node@v4')
    expect(result.content).toContain('bun install --frozen-lockfile')
    expect(result.content).toContain('bun run build')
    expect(result.content).toContain('bunx @codepushgo/cli@latest release com.example.app --platform ios')
  })

  it('uses npm/npx for customer-facing workflow content', () => {
    const result = generateWorkflow({ appId: 'com.example.app', platform: 'android', packageManager: 'npm', buildScript: { type: 'custom', command: 'npm run bundle' } })
    expect(result.content).toContain('npm ci')
    expect(result.content).toContain('npm run bundle')
    expect(result.content).toContain('npx @codepushgo/cli@latest release com.example.app --platform android')
    expect(result.content).not.toContain('setup-bun')
  })
})
