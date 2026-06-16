export interface VerifiedAppCandidate {
  appId?: string
  app_id?: string
  bundle_id?: string
  bundleId?: string
  name?: string
}

export type AppVerificationResult
  = | { result: 'exact-match', matchedApp: VerifiedAppCandidate }
    | { result: 'wrong-build-id' | 'no-app-identifier-exists' | 'no-app-unregistered', matchedApp: null }

function candidateBundleId(app: VerifiedAppCandidate) {
  return app.bundleId ?? app.bundle_id ?? app.appId ?? app.app_id
}

export function classifyAppVerification(input: { releaseBundleId: string, apps: VerifiedAppCandidate[], registeredBundleIds?: string[] }): AppVerificationResult {
  const matchedApp = input.apps.find(app => candidateBundleId(app) === input.releaseBundleId)
  if (matchedApp)
    return { result: 'exact-match', matchedApp }

  if (input.apps.length > 0)
    return { result: 'wrong-build-id', matchedApp: null }

  if (input.registeredBundleIds?.includes(input.releaseBundleId))
    return { result: 'no-app-identifier-exists', matchedApp: null }

  return { result: 'no-app-unregistered', matchedApp: null }
}

export function evaluateGate(input: { satisfied: boolean, attempt: number }) {
  if (input.satisfied)
    return { proceed: true, escalationLevel: 0 }
  return { proceed: false, escalationLevel: Math.max(0, Math.min(3, input.attempt)) }
}
