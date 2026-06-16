import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { shouldIncludeBundleFile, zipDirectory } from '../src/archive'

describe('[Capgo parity] React Native bundle zip filtering', () => {
  it('skips generated host metadata while keeping bundle assets', () => {
    expect(shouldIncludeBundleFile('.DS_Store')).toBe(false)
    expect(shouldIncludeBundleFile('__MACOSX/._index.bundle')).toBe(false)
    expect(shouldIncludeBundleFile('.git/config')).toBe(false)
    expect(shouldIncludeBundleFile('assets/logo.png')).toBe(true)
    expect(shouldIncludeBundleFile('index.ios.bundle')).toBe(true)
  })

  it('generated upload zip contains only deployable React Native bundle files', async () => {
    const root = join(tmpdir(), `codepushgo-zip-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(join(root, 'assets'), { recursive: true })
    await mkdir(join(root, '__MACOSX'), { recursive: true })
    await mkdir(join(root, '.git'), { recursive: true })
    await writeFile(join(root, 'index.android.bundle'), 'bundle')
    await writeFile(join(root, 'assets/logo.png'), 'image')
    await writeFile(join(root, '.DS_Store'), 'junk')
    await writeFile(join(root, '__MACOSX/._index.android.bundle'), 'junk')
    await writeFile(join(root, '.git/config'), 'junk')

    const files = unzipSync(await zipDirectory(root))
    expect(strFromU8(files['index.android.bundle']!)).toBe('bundle')
    expect(strFromU8(files['assets/logo.png']!)).toBe('image')
    expect(files['.DS_Store']).toBeUndefined()
    expect(files['__MACOSX/._index.android.bundle']).toBeUndefined()
    expect(files['.git/config']).toBeUndefined()
  })
})
