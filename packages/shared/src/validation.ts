const appIdPattern = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function isValidAppId(value: unknown): value is string {
  return typeof value === 'string' && appIdPattern.test(value)
}

export function isValidReleaseVersion(value: unknown): value is string {
  return typeof value === 'string' && semverPattern.test(value)
}
