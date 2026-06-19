interface LegacyAppRoute {
  params: {
    package?: string | string[]
  }
}

function legacyAppRedirect(route: LegacyAppRoute) {
  const packageId = route.params.package
  return `/app/${Array.isArray(packageId) ? packageId[0] : packageId ?? ''}`
}

export const guestPath = [
  '/login',
  '/confirm-signup',
  '/forgot_password',
  '/resend_email',
  '/register',
  '/sso-callback',
]

export const canonicalRedirects = [
  { path: '/', redirect: '/login' },
  { path: '/app/home', redirect: '/dashboard' },
  { path: '/apikeys', redirect: '/dashboard/apikeys' },
  { path: '/app', redirect: '/apps' },
  { path: '/p/:package', redirect: legacyAppRedirect },
  { path: '/app/p/:package', redirect: legacyAppRedirect },
  { path: '/app/p/:package/bundle', redirect: legacyAppRedirect },
  { path: '/app/p/:package/bundles', redirect: legacyAppRedirect },
  { path: '/app/p/:package/channels', redirect: legacyAppRedirect },
  { path: '/app/p/:package/devices', redirect: legacyAppRedirect },
  { path: '/app/p/:package/stats', redirect: legacyAppRedirect },
  { path: '/app/package/:package', redirect: legacyAppRedirect },
  { path: '/app/package/:package/settings', redirect: legacyAppRedirect },
] as const
