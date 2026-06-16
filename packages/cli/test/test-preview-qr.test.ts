import { describe, expect, it } from 'vitest'
import { buildBundleUploadPreviewQrOptions, buildPreviewQrUrl, renderTerminalQrCode } from '../src/preview-qr'

describe('[Capgo parity] preview QR links', () => {
  it('builds compact CodePushGo bundle and channel preview links', () => {
    expect(buildPreviewQrUrl({ appId: 'com.example.app', kind: 'bundle', versionId: 42 })).toBe('codepushgo://preview/bundle?appId=com.example.app&versionId=42')
    expect(buildPreviewQrUrl({ appId: 'com.example.app', channelId: 7, channelName: 'production', kind: 'channel' })).toBe('codepushgo://preview/channel?appId=com.example.app&channel=production&channelId=7')
  })

  it('renders terminal QR text and rewrites post-upload bundle options', () => {
    expect(renderTerminalQrCode('codepushgo://preview/bundle?appId=com.example.app&versionId=42')).toContain('\n')
    expect(buildBundleUploadPreviewQrOptions({ token: 'test-key', bundle: 'original', channel: 'production', qrPreview: true, endpoint: 'https://api.test' }, 'uploaded')).toEqual({ token: 'test-key', endpoint: 'https://api.test', bundle: 'uploaded' })
  })
})
