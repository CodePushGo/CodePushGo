import type { Platform } from '@codepushgo/shared'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export interface ReactNativeBundleOptions {
  platform: Platform
  entryFile: string
  outDir: string
  dev?: boolean
  sourcemap?: boolean
}

export function reactNativeBundleArgs(options: ReactNativeBundleOptions): string[] {
  const bundleOutput = join(options.outDir, `index.${options.platform}.bundle`)
  const assetsDest = join(options.outDir, 'assets')
  const args = [
    'react-native',
    'bundle',
    '--platform', options.platform,
    '--entry-file', options.entryFile,
    '--bundle-output', bundleOutput,
    '--assets-dest', assetsDest,
    '--dev', String(options.dev ?? false),
  ]

  if (options.sourcemap)
    args.push('--sourcemap-output', `${bundleOutput}.map`)

  return args
}

export async function runReactNativeBundle(options: ReactNativeBundleOptions) {
  await mkdir(options.outDir, { recursive: true })
  const args = reactNativeBundleArgs(options)

  await new Promise<void>((resolve, reject) => {
    const child = spawn('bunx', args, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0)
        resolve()
      else
        reject(new Error(`React Native bundle failed with exit code ${code}`))
    })
  })
}
