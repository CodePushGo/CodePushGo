import { execFileSync } from 'node:child_process'

export interface GitRepoStatus {
  inRepo: boolean
  clean: boolean
  entries: string[]
  error?: string
}

export type InitAutoTestChangeKind = 'html-banner' | 'vue-banner' | 'css-background'

export interface InitAutoTestChange {
  kind: InitAutoTestChangeKind
  content: string
}

export function isAppAlreadyExistsError(error: unknown) {
  if (!error)
    return false
  const record = typeof error === 'object' ? error as { code?: unknown, message?: unknown } : {}
  const message = error instanceof Error ? error.message : typeof record.message === 'string' ? record.message : String(error)
  return record.code === '23505'
    || /already exists/i.test(message)
    || /duplicate key/i.test(message)
    || /23505/.test(message)
}

export function buildAppIdConflictSuggestions(appId: string, random = Math.random, now = Date.now) {
  const suffix = Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')
  const timestamp = String(now()).slice(-4)
  return [
    `${appId}-${suffix}`,
    `${appId}.dev`,
    `${appId}.app`,
    `${appId}-${timestamp}`,
    `${appId}2`,
    `${appId}3`,
  ]
}

export function getGitRepoStatus(root: string): GitRepoStatus {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'pipe' })
  }
  catch {
    return { inRepo: false, clean: true, entries: [] }
  }

  try {
    const output = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
    const entries = output.split('\n').filter(Boolean)
    return { inRepo: true, clean: entries.length === 0, entries }
  }
  catch (error) {
    return { inRepo: true, clean: false, entries: [], error: error instanceof Error ? error.message : String(error) }
  }
}
export function getInitUpdaterPluginConfig(appId: string) {
  return {
    version: '0.0.0',
    appId,
    autoUpdate: 'atBackground',
  }
}
export function getInitOtaVersionBase(nativeVersion: string) {
  return nativeVersion.startsWith('0.') ? nativeVersion : '0.0.0'
}

export function getInitSuggestedOtaVersion(nativeVersion: string) {
  const [major = '0', minor = '0', patch = '0'] = getInitOtaVersionBase(nativeVersion).split('.')
  return `${major}.${minor}.${Number(patch) + 1}`
}

export function applyInitAutoTestChange(filePath: string, content: string): InitAutoTestChange | null {
  if (filePath.endsWith('.html') && content.includes('</body>'))
    return { kind: 'html-banner', content: content.replace('</body>', '  <div id="codepushgo-test-banner">CodePushGo test</div>\n</body>') }
  if (filePath.endsWith('.vue') && content.includes('</template>'))
    return { kind: 'vue-banner', content: content.replace('</template>', '  <div data-codepushgo-test-vue>CodePushGo test</div>\n</template>') }
  if (filePath.endsWith('.css')) {
    const marker = '/* CodePushGo test modification - background change */\nbody { background: #f7fbff; }\n'
    const header = content.match(/^((?:@charset[^;]+;\n|@import[^;]+;\n)+)/)?.[0] ?? ''
    return { kind: 'css-background', content: `${header}${marker}${content.slice(header.length)}` }
  }
  return null
}

export function revertInitAutoTestChangeContent(kind: InitAutoTestChangeKind, content: string) {
  if (kind === 'html-banner')
    return content.replace('  <div id="codepushgo-test-banner">CodePushGo test</div>\n</body>', '</body>')
  if (kind === 'vue-banner')
    return content.replace('  <div data-codepushgo-test-vue>CodePushGo test</div>\n</template>', '</template>')
  return content.replace('/* CodePushGo test modification - background change */\nbody { background: #f7fbff; }\n', '')
}

export function isOnlyAllowedInitAutoTestChange(status: GitRepoStatus, change: { displayPath: string }) {
  return status.inRepo && !status.clean && status.entries.length === 1 && status.entries[0]?.includes(change.displayPath)
}

export function usesAlwaysDirectUpdate(_config: { autoUpdate?: unknown, directUpdate?: unknown }) {
  return false
}
