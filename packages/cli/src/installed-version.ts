import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, parse, resolve } from 'node:path'

function readVersion(path: string) {
  if (!existsSync(path))
    return undefined
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown }
    return typeof pkg.version === 'string' ? pkg.version : undefined
  }
  catch {
    return undefined
  }
}

export function getInstalledVersion(packageName: string, rootDir = process.cwd(), packageJsonPath?: string): string | undefined {
  const bases = new Set<string>([resolve(rootDir), process.cwd()])
  for (const item of packageJsonPath?.split(',').map(value => value.trim()).filter(Boolean) ?? []) {
    const path = resolve(rootDir, item)
    if (existsSync(path))
      bases.add(dirname(path))
  }

  for (const base of bases) {
    try {
      const requireFromBase = createRequire(join(base, 'package.json'))
      const resolved = requireFromBase.resolve(`${packageName}/package.json`)
      const version = readVersion(resolved)
      if (version)
        return version
    }
    catch {}
  }

  for (const base of bases) {
    let current = base
    const root = parse(current).root
    while (current !== root) {
      const version = readVersion(join(current, 'node_modules', ...packageName.split('/'), 'package.json'))
      if (version)
        return version
      const parent = dirname(current)
      if (parent === current)
        break
      current = parent
    }
  }

  for (const base of bases) {
    const pkgPath = join(base, 'package.json')
    if (!existsSync(pkgPath))
      continue
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }
      const declared = pkg.dependencies?.[packageName] ?? pkg.devDependencies?.[packageName]
      if (declared)
        return declared.replace(/^[~^]/, '')
    }
    catch {}
  }
  return undefined
}
