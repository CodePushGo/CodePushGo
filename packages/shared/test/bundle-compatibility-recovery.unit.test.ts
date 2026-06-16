import { describe, expect, it } from 'vitest'
import { BUNDLE_INCOMPATIBLE_EVENT, buildBundleCompatibilityBentoEvent } from '../src/bundle-compatibility'

const base = {
  event: BUNDLE_INCOMPATIBLE_EVENT,
  orgId: 'org-1',
  appId: 'com.demo.app',
  channelOverwritten: true,
  channel: 'production',
  source: 'upload',
  versionNewId: '101',
  versionNewName: '1.0.1',
  versionOldId: '100',
  versionOldName: '1.0.0',
  orgName: 'Demo Org',
  appName: 'Demo',
}

describe('buildBundleCompatibilityBentoEvent', () => {
  it.concurrent('exposes the trigger event name', () => {
    expect(BUNDLE_INCOMPATIBLE_EVENT).toBe('Bundle Incompatible')
  })

  it.concurrent('builds a full payload for an incompatible upload that went live', () => {
    const r = buildBundleCompatibilityBentoEvent(base)
    expect(r).toBeDefined()
    expect(r!.event).toBe('bundle_incompatible')
    expect(r!.preferenceKey).toBe('bundle_incompatible')
    expect(r!.once).toBe(true)
    expect(r!.uniqId).toBe('bundle_incompatible:com.demo.app:production:1.0.1')
    expect(r!.data).toMatchObject({
      org_id: 'org-1',
      org_name: 'Demo Org',
      app_id: 'com.demo.app',
      app_name: 'Demo',
      channel: 'production',
      source: 'upload',
      version_new_id: '101',
      version_new_name: '1.0.1',
      version_old_id: '100',
      version_old_name: '1.0.0',
    })
  })

  it.concurrent('returns undefined when the channel was not overwritten', () => {
    expect(buildBundleCompatibilityBentoEvent({ ...base, channelOverwritten: false })).toBeUndefined()
    expect(buildBundleCompatibilityBentoEvent({ ...base, channelOverwritten: undefined })).toBeUndefined()
  })

  it.concurrent('falls back to the old version in uniqId when the new version is absent', () => {
    const r = buildBundleCompatibilityBentoEvent({ ...base, versionNewId: undefined, versionNewName: undefined })
    expect(r).toBeDefined()
    expect(r!.uniqId).toBe('bundle_incompatible:com.demo.app:production:1.0.0')
    expect(r!.data.version_new_id).toBe('')
    expect(r!.data.version_old_name).toBe('1.0.0')
  })

  it.concurrent('returns undefined for other event names or missing ids', () => {
    expect(buildBundleCompatibilityBentoEvent({ ...base, event: 'Bundle Upload Compatibility Checked' })).toBeUndefined()
    expect(buildBundleCompatibilityBentoEvent({ ...base, orgId: undefined })).toBeUndefined()
    expect(buildBundleCompatibilityBentoEvent({ ...base, appId: undefined })).toBeUndefined()
  })

  it.concurrent('defaults missing fields to safe empties', () => {
    const r = buildBundleCompatibilityBentoEvent({
      ...base,
      source: undefined,
      channel: undefined,
      orgName: undefined,
      appName: undefined,
      versionNewId: undefined,
      versionNewName: undefined,
      versionOldId: undefined,
      versionOldName: undefined,
    })
    expect(r).toBeDefined()
    expect(r!.data.source).toBe('unknown')
    expect(r!.data.channel).toBe('')
    expect(r!.data.org_name).toBe('')
    expect(r!.data.app_name).toBe('')
    expect(r!.uniqId).toBe('bundle_incompatible:com.demo.app::')
  })
})
