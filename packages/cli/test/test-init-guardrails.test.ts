import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyInitAutoTestChange, getGitRepoStatus, getInitOtaVersionBase, getInitSuggestedOtaVersion, getInitUpdaterPluginConfig, isOnlyAllowedInitAutoTestChange, revertInitAutoTestChangeContent, usesAlwaysDirectUpdate } from '../src/init-conflict'

function withTempDir(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'codepushgo-init-guardrails-'))
  try {
    fn(root)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('[Capgo parity] init guardrails', () => {
  it('reports git cleanliness without failing outside repos', () => {
    withTempDir((root) => {
      expect(getGitRepoStatus(root)).toEqual({ inRepo: false, clean: true, entries: [] })
      execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' })
      expect(getGitRepoStatus(root)).toMatchObject({ inRepo: true, clean: true, entries: [] })
      writeFileSync(join(root, 'dirty.txt'), 'dirty\n')
      expect(getGitRepoStatus(root)).toMatchObject({ inRepo: true, clean: false })
    })
  })

  it('uses native baseline 0.0.0 for init and rejects direct-update complexity', () => {
    expect(getInitUpdaterPluginConfig('com.example.app')).toEqual({ version: '0.0.0', appId: 'com.example.app', autoUpdate: 'atBackground' })
    expect(getInitUpdaterPluginConfig('com.example.app')).toEqual({ version: '0.0.0', appId: 'com.example.app', autoUpdate: 'atBackground' })
    expect(getInitOtaVersionBase('1.0.0')).toBe('0.0.0')
    expect(getInitSuggestedOtaVersion('0.2.3')).toBe('0.2.4')
    expect(usesAlwaysDirectUpdate({ autoUpdate: 'always' })).toBe(false)
    expect(usesAlwaysDirectUpdate({ autoUpdate: 'atBackground', directUpdate: true })).toBe(false)
  })

  it('applies and reverts only CLI-managed onboarding test edits', () => {
    const html = '<body>\n  <main>Hello</main>\n</body>\n'
    const htmlChange = applyInitAutoTestChange('index.html', html)
    expect(htmlChange?.content).toContain('codepushgo-test-banner')
    expect(revertInitAutoTestChangeContent(htmlChange!.kind, htmlChange!.content)).toBe(html)

    const css = '@charset "UTF-8";\n@import url("./base.css");\nbody { color: red; }\n'
    const cssChange = applyInitAutoTestChange('src/main.css', css)
    expect(cssChange?.content).toContain('CodePushGo test modification')
    expect(revertInitAutoTestChangeContent(cssChange!.kind, cssChange!.content)).toBe(css)
  })

  it('allows only the expected one-file init test diff on resume', () => {
    expect(isOnlyAllowedInitAutoTestChange({ inRepo: true, clean: false, entries: [' M src/main.css'] }, { displayPath: 'src/main.css' })).toBe(true)
    expect(isOnlyAllowedInitAutoTestChange({ inRepo: true, clean: false, entries: [' M src/main.css', ' M src/App.tsx'] }, { displayPath: 'src/main.css' })).toBe(false)
  })
})
