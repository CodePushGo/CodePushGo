export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
}

export function shouldShowUpdatePrompt(info?: UpdateInfo | null) {
  return !!info && info.currentVersion !== info.latestVersion
}

export function formatUpdatePrompt(info: UpdateInfo) {
  return `A new version of @codepushgo/cli is available: ${info.currentVersion} -> ${info.latestVersion}`
}
