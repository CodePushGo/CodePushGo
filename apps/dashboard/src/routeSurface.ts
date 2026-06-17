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
  { path: '/dashboard', redirect: '/app/home' },
  { path: '/app', redirect: '/apps' },
] as const
