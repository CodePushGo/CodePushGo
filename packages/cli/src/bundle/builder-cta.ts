import { trackEvent } from '../analytics/track'

export type BuilderCtaSurface = 'skip' | 'ci-ad' | 'prompt-onboarding' | 'prompt-build'
export type BuilderCtaAction = 'continue' | 'abort' | 'launch-onboarding' | 'launch-build'
export type BuilderCtaChoice = 'yes' | 'no' | 'learn'

export interface BuilderCtaDecisionInput {
  incompatible: boolean
  interactive: boolean
  hasCredentials: boolean
}

export interface BuilderCtaSelectOptions {
  message: string
  options: Array<{ value: BuilderCtaChoice, label: string }>
  initialValue?: BuilderCtaChoice
}

export type BuilderCtaSelect = (options: BuilderCtaSelectOptions) => Promise<BuilderCtaChoice | symbol>
export type OpenUrl = (url: string) => Promise<unknown> | unknown
export type Warn = (message: string) => void

export interface MaybePromptBuilderCtaParams extends BuilderCtaDecisionInput {
  appId: string
  orgId: string
  apikey: string
  incompatibleCount: number
  select?: BuilderCtaSelect
  openUrl?: OpenUrl
  warn?: Warn
}

export interface ShouldBlockIncompatibleUploadInput {
  incompatible: boolean
  forceNativeBuild?: boolean
  disableNativeBuildGate?: boolean
  failOnIncompatible?: boolean
  interactive?: boolean
  builderAction?: BuilderCtaAction
}

const LEARN_URL = 'https://capgo.app/native-build/'
const DOCS_URL = 'https://capgo.app/docs/cli/cloud-build/'
const CTA_OPTIONS: BuilderCtaSelectOptions['options'] = [
  { value: 'yes', label: '✅ Yes' },
  { value: 'no', label: '❌ No' },
  { value: 'learn', label: '📖 Learn what Capgo Builder is' },
]

export function decideBuilderCtaSurface(input: BuilderCtaDecisionInput): BuilderCtaSurface {
  if (!input.incompatible)
    return 'skip'
  if (!input.interactive)
    return 'ci-ad'
  if (!input.hasCredentials)
    return 'prompt-onboarding'
  return 'prompt-build'
}

export function shouldBlockIncompatibleUpload(input: ShouldBlockIncompatibleUploadInput): boolean {
  if (!input.incompatible)
    return false
  if (input.forceNativeBuild || input.disableNativeBuildGate)
    return false
  if (input.failOnIncompatible === undefined)
    return true
  if (!input.failOnIncompatible)
    return false
  return input.builderAction === undefined || input.builderAction === 'continue' || input.builderAction === 'abort'
}

function defaultWarn(message: string) {
  console.warn(message)
}

async function defaultSelect(): Promise<BuilderCtaChoice> {
  return 'no'
}

async function defaultOpenUrl(url: string) {
  const childProcess = await import('node:child_process')
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open'

  childProcess.spawn(command, [url], {
    stdio: 'ignore',
    detached: true,
  }).unref()
}

function isPromptCancel(choice: BuilderCtaChoice | symbol): choice is symbol {
  return typeof choice === 'symbol'
}

function trackBuilderCta(input: MaybePromptBuilderCtaParams, surface: BuilderCtaSurface, action: BuilderCtaAction) {
  void trackEvent({
    apikey: input.apikey,
    event: 'Builder CTA',
    channel: 'builder-cta',
    icon: '🏗️',
    notify: false,
    orgId: input.orgId,
    tags: {
      app_id: input.appId,
      surface,
      action,
      incompatible_count: String(input.incompatibleCount),
      has_credentials: String(input.hasCredentials),
    },
  })
}

function printBuilderCiAd(input: MaybePromptBuilderCtaParams, warn: Warn) {
  const setup = input.hasCredentials ? 'run a native build' : 'configure CodePushGo Builder'
  warn(`This React Native bundle includes ${input.incompatibleCount} native change(s). Use CodePushGo Builder to ${setup}: ${DOCS_URL}`)
}

async function promptForBuilderAction(input: MaybePromptBuilderCtaParams, message: string): Promise<BuilderCtaAction> {
  const select = input.select ?? defaultSelect
  const openUrl = input.openUrl ?? defaultOpenUrl
  const warn = input.warn ?? defaultWarn

  for (;;) {
    const choice = await select({
      message,
      options: CTA_OPTIONS,
      initialValue: 'yes',
    })

    if (isPromptCancel(choice))
      return 'abort'
    if (choice === 'no')
      return 'continue'
    if (choice === 'yes')
      return input.hasCredentials ? 'launch-build' : 'launch-onboarding'

    try {
      await openUrl(LEARN_URL)
    }
    catch {
      warn(`Could not open your browser automatically. Visit: ${LEARN_URL}`)
    }
  }
}

export async function maybePromptBuilderCta(input: MaybePromptBuilderCtaParams): Promise<BuilderCtaAction> {
  const surface = decideBuilderCtaSurface(input)
  if (surface === 'skip')
    return 'continue'

  if (surface === 'ci-ad') {
    printBuilderCiAd(input, input.warn ?? defaultWarn)
    trackBuilderCta(input, surface, 'continue')
    return 'continue'
  }

  const message = surface === 'prompt-build'
    ? 'Start a native build with Capgo Builder now?'
    : 'Would you like to configure Capgo Builder now?'

  const action = await promptForBuilderAction(input, message)
  trackBuilderCta(input, surface, action)
  return action
}
