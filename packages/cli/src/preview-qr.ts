export type PreviewQrTarget =
  | { kind: 'bundle', appId: string, versionId: number, bundleName?: string }
  | { kind: 'channel', appId: string, channelId: number, channelName: string }

export function buildPreviewQrUrl(target: PreviewQrTarget) {
  if (target.kind === 'bundle')
    return `codepushgo://preview/bundle?appId=${encodeURIComponent(target.appId)}&versionId=${target.versionId}`
  return `codepushgo://preview/channel?appId=${encodeURIComponent(target.appId)}&channel=${encodeURIComponent(target.channelName)}&channelId=${target.channelId}`
}

export function renderTerminalQrCode(url: string) {
  const border = '#'.repeat(Math.min(80, Math.max(24, url.length + 8)))
  return [border, `## ${url} ##`, border].join('\n')
}

export function buildBundleUploadPreviewQrOptions(input: { token?: string, bundle?: string, channel?: string, qrPreview?: boolean, endpoint?: string }, uploadedBundle: string) {
  if (!input.qrPreview)
    return undefined
  return {
    ...(input.token ? { token: input.token } : {}),
    ...(input.endpoint ? { endpoint: input.endpoint } : {}),
    bundle: uploadedBundle,
  }
}
