import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { getInstalledVersion } from '../src/installed-version'

describe('[Capgo parity] installed version lookup', () => {
  it('reads installed package version from node_modules', async () => {
    const root = join(tmpdir(), `codepushgo-installed-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(join(root, 'node_modules/@codepushgo/react-native-updater'), { recursive: true })
    await writeFile(join(root, 'node_modules/@codepushgo/react-native-updater/package.json'), JSON.stringify({ version: '1.2.3' }))
    expect(getInstalledVersion('@codepushgo/react-native-updater', root)).toBe('1.2.3')
  })

  it('falls back to declared dependency versions', async () => {
    const root = join(tmpdir(), `codepushgo-declared-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { '@codepushgo/react-native-updater': '^2.3.4' } }))
    expect(getInstalledVersion('@codepushgo/react-native-updater', root)).toBe('2.3.4')
  })
})
