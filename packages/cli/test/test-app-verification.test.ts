import { describe, expect, it } from 'vitest'
import { classifyAppVerification, evaluateGate } from '../src/app-verification'

describe('[Capgo parity] app verification for RN bundle ids', () => {
  it('returns exact-match with the matched app', () => {
    expect(classifyAppVerification({
      releaseBundleId: 'com.foo.app',
      apps: [{ bundle_id: 'com.other.app', name: 'Other' }, { app_id: 'com.foo.app', name: 'Foo' }],
      registeredBundleIds: ['com.foo.app'],
    })).toEqual({ result: 'exact-match', matchedApp: { app_id: 'com.foo.app', name: 'Foo' } })
  })

  it('separates wrong app id, missing app, and unregistered bundle id states', () => {
    expect(classifyAppVerification({
      releaseBundleId: 'com.foo.typo',
      apps: [{ bundleId: 'com.foo.app', name: 'Foo' }],
      registeredBundleIds: ['com.foo.app'],
    })).toEqual({ result: 'wrong-build-id', matchedApp: null })

    expect(classifyAppVerification({
      releaseBundleId: 'com.foo.app',
      apps: [],
      registeredBundleIds: ['com.foo.app'],
    })).toEqual({ result: 'no-app-identifier-exists', matchedApp: null })

    expect(classifyAppVerification({
      releaseBundleId: 'com.foo.app',
      apps: [],
      registeredBundleIds: [],
    })).toEqual({ result: 'no-app-unregistered', matchedApp: null })
  })

  it('caps verification gate escalation', () => {
    expect(evaluateGate({ satisfied: true, attempt: 7 })).toEqual({ proceed: true, escalationLevel: 0 })
    expect(evaluateGate({ satisfied: false, attempt: 0 })).toEqual({ proceed: false, escalationLevel: 0 })
    expect(evaluateGate({ satisfied: false, attempt: 2 })).toEqual({ proceed: false, escalationLevel: 2 })
    expect(evaluateGate({ satisfied: false, attempt: 99 })).toEqual({ proceed: false, escalationLevel: 3 })
  })
})
