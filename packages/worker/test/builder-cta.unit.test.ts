import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decideBuilderCtaSurface,
  maybePromptBuilderCta,
  type MaybePromptBuilderCtaParams,
} from '../../cli/src/bundle/builder-cta'

const trackEventMock = vi.hoisted(() => vi.fn())

vi.mock('../../cli/src/analytics/track', () => ({
  trackEvent: trackEventMock,
}))

const baseParams: MaybePromptBuilderCtaParams = {
  incompatible: true,
  interactive: true,
  hasCredentials: false,
  appId: 'com.app',
  orgId: 'org1',
  apikey: 'k',
  incompatibleCount: 2,
}

const learnUrl = 'https://capgo.app/native-build/'

describe('[Capgo parity] builder CTA surface decision', () => {
  it('skips compatible bundles', () => {
    expect(decideBuilderCtaSurface({
      incompatible: false,
      interactive: true,
      hasCredentials: false,
    })).toBe('skip')
  })

  it('prints a CI ad for incompatible non-interactive uploads', () => {
    expect(decideBuilderCtaSurface({
      incompatible: true,
      interactive: false,
      hasCredentials: false,
    })).toBe('ci-ad')
  })

  it('prompts onboarding when credentials are missing', () => {
    expect(decideBuilderCtaSurface({
      incompatible: true,
      interactive: true,
      hasCredentials: false,
    })).toBe('prompt-onboarding')
  })

  it('prompts native build when credentials exist', () => {
    expect(decideBuilderCtaSurface({
      incompatible: true,
      interactive: true,
      hasCredentials: true,
    })).toBe('prompt-build')
  })
})

describe('[Capgo parity] maybePromptBuilderCta', () => {
  beforeEach(() => {
    trackEventMock.mockReset()
  })

  it('continues and does not prompt for compatible bundles', async () => {
    const select = vi.fn()
    const result = await maybePromptBuilderCta({
      ...baseParams,
      incompatible: false,
      select,
    })

    expect(result).toBe('continue')
    expect(select).not.toHaveBeenCalled()
  })

  it('launches onboarding when credentials are missing and user accepts', async () => {
    const select = vi.fn().mockResolvedValue('yes')
    const result = await maybePromptBuilderCta({ ...baseParams, select })

    expect(result).toBe('launch-onboarding')
    expect(select).toHaveBeenCalledWith({
      message: expect.stringContaining('Would you like to configure Capgo Builder now?'),
      options: [
        { value: 'yes', label: '✅ Yes' },
        { value: 'no', label: '❌ No' },
        { value: 'learn', label: '📖 Learn what Capgo Builder is' },
      ],
      initialValue: 'yes',
    })
  })

  it('launches native build when credentials exist and user accepts', async () => {
    const select = vi.fn().mockResolvedValue('yes')
    const result = await maybePromptBuilderCta({
      ...baseParams,
      hasCredentials: true,
      select,
    })

    expect(result).toBe('launch-build')
    expect(select).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Start a native build with Capgo Builder now?'),
    }))
  })

  it('continues when user declines', async () => {
    const select = vi.fn().mockResolvedValue('no')
    const result = await maybePromptBuilderCta({ ...baseParams, select })

    expect(result).toBe('continue')
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('aborts when the prompt is canceled', async () => {
    const select = vi.fn().mockResolvedValue(Symbol('cancel'))
    const result = await maybePromptBuilderCta({ ...baseParams, select })

    expect(result).toBe('abort')
  })

  it('opens learn URL then asks again', async () => {
    const select = vi.fn()
      .mockResolvedValueOnce('learn')
      .mockResolvedValueOnce('no')
    const openUrl = vi.fn().mockResolvedValue(undefined)

    const result = await maybePromptBuilderCta({ ...baseParams, select, openUrl })

    expect(result).toBe('continue')
    expect(openUrl).toHaveBeenCalledWith(learnUrl)
    expect(select).toHaveBeenCalledTimes(2)
  })

  it('opens learn URL then launches build when credentials exist and user accepts', async () => {
    const select = vi.fn()
      .mockResolvedValueOnce('learn')
      .mockResolvedValueOnce('yes')
    const openUrl = vi.fn().mockResolvedValue(undefined)

    const result = await maybePromptBuilderCta({
      ...baseParams,
      hasCredentials: true,
      select,
      openUrl,
    })

    expect(result).toBe('launch-build')
    expect(openUrl).toHaveBeenCalledWith(learnUrl)
  })

  it('warns when opening the learn URL fails and asks again', async () => {
    const select = vi.fn()
      .mockResolvedValueOnce('learn')
      .mockResolvedValueOnce('yes')
    const openUrl = vi.fn().mockRejectedValue(new Error('blocked'))
    const warn = vi.fn()

    const result = await maybePromptBuilderCta({ ...baseParams, select, openUrl, warn })

    expect(result).toBe('launch-onboarding')
    expect(warn).toHaveBeenCalledWith(`Could not open your browser automatically. Visit: ${learnUrl}`)
  })

  it('continues without prompt in non-interactive mode', async () => {
    const select = vi.fn()
    const warn = vi.fn()
    const result = await maybePromptBuilderCta({
      ...baseParams,
      interactive: false,
      select,
      warn,
    })

    expect(result).toBe('continue')
    expect(select).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('CodePushGo Builder'))
  })
})
