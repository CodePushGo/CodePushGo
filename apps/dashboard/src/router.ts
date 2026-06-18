import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { canonicalRedirects, guestPath } from './routeSurface'
import ConfirmSignupView from './views/ConfirmSignupView.vue'
import ConsoleView from './views/ConsoleView.vue'
import ForgotPasswordView from './views/ForgotPasswordView.vue'
import LoginView from './views/LoginView.vue'
import OrganizationOnboardingView from './views/OrganizationOnboardingView.vue'
import RegisterView from './views/RegisterView.vue'
import ResendEmailView from './views/ResendEmailView.vue'
import SsoCallbackView from './views/SsoCallbackView.vue'

export { guestPath }

export const dashboardRoutes: RouteRecordRaw[] = [
  ...canonicalRedirects,
  { path: '/apps', component: ConsoleView, meta: { middleware: 'auth' } },
  { path: '/dashboard/apikeys', component: ConsoleView, meta: { middleware: 'auth' } },
  { path: '/dashboard/settings/:pathMatch(.*)*', component: ConsoleView, meta: { middleware: 'auth' } },
  { path: '/onboarding/organization', component: OrganizationOnboardingView, meta: { middleware: 'auth' } },
  { path: '/app/home', component: ConsoleView, meta: { middleware: 'auth' } },
  { path: '/app/:appId/:pathMatch(.*)*', component: ConsoleView, meta: { middleware: 'auth' } },
  { path: '/login', component: LoginView, meta: { layout: 'naked' } },
  { path: '/register', component: RegisterView, meta: { layout: 'naked' } },
  { path: '/forgot_password', component: ForgotPasswordView, meta: { layout: 'naked' } },
  { path: '/confirm-signup', component: ConfirmSignupView, meta: { layout: 'naked' } },
  { path: '/resend_email', component: ResendEmailView, meta: { layout: 'naked' } },
  { path: '/sso-callback', component: SsoCallbackView, meta: { layout: 'naked' } },
  { path: '/:pathMatch(.*)*', redirect: '/app/home' },
]

export function createDashboardRouter() {
  return createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: dashboardRoutes,
  })
}
