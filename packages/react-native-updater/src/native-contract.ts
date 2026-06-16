export type AutoUpdateMode = 'false' | 'true' | 'atBackground'
export type NormalizedAutoUpdateMode = 'off' | 'atBackground'
export type UpdateResponseKind = 'up_to_date' | 'blocked' | 'failed'

const minimumPeriodCheckDelaySeconds = 600

export interface NormalizedAutoUpdate {
  mode: NormalizedAutoUpdateMode
  enabled: boolean
  checkOnStart: boolean
}

export function normalizePeriodCheckDelay(seconds: number) {
  if (seconds <= 0)
    return 0
  return Math.max(seconds, minimumPeriodCheckDelaySeconds)
}

export function normalizeAutoUpdateMode(mode: string | null | undefined): NormalizedAutoUpdate {
  switch (mode) {
    case 'false':
      return { mode: 'off', enabled: false, checkOnStart: false }
    case 'true':
    case 'atBackground':
    default:
      return { mode: 'atBackground', enabled: true, checkOnStart: true }
  }
}

export function normalizeUpdateResponseKind(kind: string | null | undefined): UpdateResponseKind {
  if (kind === 'up_to_date' || kind === 'blocked' || kind === 'failed')
    return kind
  return 'failed'
}
