import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { canonicalRedirects, guestPath } from './routeSurface'
import ConfirmSignupView from './views/ConfirmSignupView.vue'
import ConsoleView from './views/ConsoleView.vue'
import ConsoleApiKeysPage from './views/console/ConsoleApiKeysPage.vue'
import ConsoleAppOverviewPage from './views/console/ConsoleAppOverviewPage.vue'
import ConsoleBundlesPage from './views/console/ConsoleBundlesPage.vue'
import ConsoleChannelsPage from './views/console/ConsoleChannelsPage.vue'
import ConsoleDevicesPage from './views/console/ConsoleDevicesPage.vue'
import ConsoleHomePage from './views/console/ConsoleHomePage.vue'
import ConsoleSettingsPage from './views/console/ConsoleSettingsPage.vue'
import ConsoleStatsPage from './views/console/ConsoleStatsPage.vue'
import ForgotPasswordView from './views/ForgotPasswordView.vue'
import LoginView from './views/LoginView.vue'
import OrganizationOnboardingView from './views/OrganizationOnboardingView.vue'
import RegisterView from './views/RegisterView.vue'
import ResendEmailView from './views/ResendEmailView.vue'
import SsoCallbackView from './views/SsoCallbackView.vue'

export { guestPath }

export const consoleRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: ConsoleView,
    meta: { middleware: 'auth' },
    children: [
      { path: 'apps', component: ConsoleHomePage },
      { path: 'app/home', component: ConsoleHomePage },
      { path: 'dashboard/apikeys', component: ConsoleApiKeysPage },
      { path: 'dashboard/settings/:pathMatch(.*)*', component: ConsoleSettingsPage },
      { path: 'app/:appId', component: ConsoleAppOverviewPage },
      { path: 'app/:appId/bundles', component: ConsoleBundlesPage },
      { path: 'app/:appId/bundles/:bundle', component: ConsoleBundlesPage },
      { path: 'app/:appId/bundle/:bundle', component: ConsoleBundlesPage },
      { path: 'app/:appId/channels', component: ConsoleChannelsPage },
      { path: 'app/:appId/channel/:channel', component: ConsoleChannelsPage },
      { path: 'app/:appId/devices', component: ConsoleDevicesPage },
      { path: 'app/:appId/device/:device', component: ConsoleDevicesPage },
      { path: 'app/:appId/stats', component: ConsoleStatsPage },
      { path: 'app/:appId/logs', component: ConsoleStatsPage },
      { path: 'app/:appId/:pathMatch(.*)*', component: ConsoleAppOverviewPage },
    ],
  },
]

export const dashboardRoutes: RouteRecordRaw[] = [
  ...canonicalRedirects,
  ...consoleRoutes,
  { path: '/onboarding/organization', component: OrganizationOnboardingView, meta: { middleware: 'auth' } },
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
