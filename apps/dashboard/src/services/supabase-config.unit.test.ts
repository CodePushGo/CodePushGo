import { describe, expect, it } from 'vitest'
import { type CodePushGoConfig, mergeRemoteConfig } from './supabase'

describe('[Capgo parity] supabase config merging', () => {
  const localConfig: CodePushGoConfig = {
    apiHost: 'https://api.codepushgo.com',
    apiKey: 'local-worker-key',
    projectId: 'codepushgo',
    host: 'https://console.codepushgo.com',
    hostWeb: 'https://codepushgo.com',
    stripeEnabled: true,
  }

  it.concurrent('keeps Worker connection parameters from the local build config', () => {
    const merged = mergeRemoteConfig(localConfig, {
      apiHost: 'https://evil.example.com',
      apiKey: 'evil-key',
      projectId: 'evil',
      host: 'https://console.next.codepushgo.com',
      hostWeb: 'https://www.codepushgo.com',
      stripeEnabled: false,
    })

    expect(merged.apiHost).toBe(localConfig.apiHost)
    expect(merged.apiKey).toBe(localConfig.apiKey)
    expect(merged.projectId).toBe(localConfig.projectId)
    expect(merged.host).toBe('https://console.next.codepushgo.com')
    expect(merged.hostWeb).toBe('https://www.codepushgo.com')
    expect(merged.stripeEnabled).toBe(false)
  })

  it.concurrent('falls back to local values when remote config omits optional fields', () => {
    const merged = mergeRemoteConfig(localConfig, {})

    expect(merged).toEqual(localConfig)
  })
})
