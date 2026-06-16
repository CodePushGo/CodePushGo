export const WORKFLOW_PATH = '.github/workflows/codepushgo-release.yml'

export type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'
export type BuildScript = { type: 'npm-script', name: string } | { type: 'custom', command: string } | { type: 'skip' }

function installCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case 'bun': return 'bun install --frozen-lockfile'
    case 'npm': return 'npm ci'
    case 'pnpm': return 'pnpm install --frozen-lockfile'
    case 'yarn': return 'yarn install --frozen-lockfile'
  }
}

function runCommand(packageManager: PackageManager, script: BuildScript) {
  if (script.type === 'skip')
    return undefined
  if (script.type === 'custom')
    return script.command
  if (packageManager === 'bun')
    return `bun run ${script.name}`
  if (packageManager === 'npm')
    return `npm run ${script.name}`
  if (packageManager === 'pnpm')
    return `pnpm run ${script.name}`
  return `yarn ${script.name}`
}

function uploadCommand(packageManager: PackageManager, appId: string, platform: string) {
  const runner = packageManager === 'bun' ? 'bunx' : packageManager === 'pnpm' ? 'pnpm dlx' : 'npx'
  return `${runner} @codepushgo/cli@latest release ${appId} --platform ${platform} --version \${{ github.sha }}`
}

export function generateWorkflow(input: { appId: string, platform: 'ios' | 'android', packageManager: PackageManager, buildScript: BuildScript, secretKeys?: string[] }) {
  const build = runCommand(input.packageManager, input.buildScript)
  const setup = input.packageManager === 'bun'
    ? ['      - uses: oven-sh/setup-bun@v2', '      - uses: actions/setup-node@v4']
    : ['      - uses: actions/setup-node@v4']
  const env = ['CODEPUSHGO_TOKEN: ${{ secrets.CODEPUSHGO_TOKEN }}', ...(input.secretKeys ?? []).map(key => `${key}: ` + '${{ secrets.' + key + ' }}')]
  const lines = [
    'name: CodePushGo Release',
    'on: workflow_dispatch',
    'jobs:',
    '  release:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    ...setup,
    '      - name: Install dependencies',
    `        run: ${installCommand(input.packageManager)}`,
    ...(build ? ['      - name: Build app', `        run: ${build}`] : []),
    '      - name: Upload CodePushGo release',
    '        env:',
    ...env.map(line => `          ${line}`),
    `        run: ${uploadCommand(input.packageManager, input.appId, input.platform)}`,
  ]
  return { path: WORKFLOW_PATH, content: `${lines.join('\n')}\n` }
}
