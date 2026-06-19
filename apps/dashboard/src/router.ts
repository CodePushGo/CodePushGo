import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { canonicalRedirects, guestPath } from './routeSurface'
import ConfirmSignupView from './views/ConfirmSignupView.vue'
import ConsoleView from './views/ConsoleView.vue'
import ConsoleApiKeysPage from './views/console/ConsoleApiKeysPage.vue'
import ConsoleAppLayout from './layouts/ConsoleAppLayout.vue'
import ConsoleAppAccessPage from './views/console/ConsoleAppAccessPage.vue'
import ConsoleAppInfoPage from './views/console/ConsoleAppInfoPage.vue'
import ConsoleAppOverviewPage from './views/console/ConsoleAppOverviewPage.vue'
import ConsoleBuildsPage from './views/console/ConsoleBuildsPage.vue'
import ConsoleBundlesPage from './views/console/ConsoleBundlesPage.vue'
import ConsoleBundleDetailPage from './views/console/ConsoleBundleDetailPage.vue'
import ConsoleChannelsPage from './views/console/ConsoleChannelsPage.vue'
import ConsoleChannelDetailPage from './views/console/ConsoleChannelDetailPage.vue'
import ConsoleDeviceDetailPage from './views/console/ConsoleDeviceDetailPage.vue'
import ConsoleDevicesPage from './views/console/ConsoleDevicesPage.vue'
import ConsoleCompatibilityPage from './views/console/ConsoleCompatibilityPage.vue'
import ConsoleHomePage from './views/console/ConsoleHomePage.vue'
import ConsoleNewAppPage from './views/console/ConsoleNewAppPage.vue'
import ConsoleSettingsLayout from './layouts/ConsoleSettingsLayout.vue'
import ConsoleSettingsPage from './views/console/ConsoleSettingsPage.vue'
import ConsoleOrganizationMembersPage from './views/console/ConsoleOrganizationMembersPage.vue'
import ConsoleOrganizationWebhooksPage from './views/console/ConsoleOrganizationWebhooksPage.vue'
import ConsoleStatsPage from './views/console/ConsoleStatsPage.vue'
import ForgotPasswordView from './views/ForgotPasswordView.vue'
import LoginView from './views/LoginView.vue'
import OrganizationOnboardingView from './views/OrganizationOnboardingView.vue'
import RegisterView from './views/RegisterView.vue'
import ResendEmailView from './views/ResendEmailView.vue'
import SsoCallbackView from './views/SsoCallbackView.vue'

export { guestPath }

const settingsFallbackRoutes = [
  'account/notifications',
  'account/change-password',
  'account/manage-2fa',
  'organization/groups',
  'organization/credits',
  'organization/security',
  'organization/usage',
  'organization/auditlogs',
].map(path => ({ path, component: ConsoleSettingsPage }))

export const consoleRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: ConsoleView,
    meta: { middleware: 'auth' },
    children: [
      { path: 'dashboard', component: ConsoleHomePage },
      { path: 'apps', component: ConsoleHomePage },
      { path: 'app/new', component: ConsoleNewAppPage },
      { path: 'app/home', redirect: '/dashboard' },
      { path: 'dashboard/apikeys', component: ConsoleApiKeysPage },
      { path: 'apikeys', redirect: '/dashboard/apikeys' },
      { path: 'dashboard/settings/:pathMatch(.*)*', redirect: '/settings/organization/plans' },
      {
        path: 'settings',
        component: ConsoleSettingsLayout,
        children: [
          { path: '', redirect: '/settings/organization' },
          { path: 'account', component: ConsoleSettingsPage },
          ...settingsFallbackRoutes,
          { path: 'account/:pathMatch(.*)*', component: ConsoleSettingsPage },
          { path: 'organization/members', component: ConsoleOrganizationMembersPage },
          { path: 'organization/webhooks', component: ConsoleOrganizationWebhooksPage },
          { path: 'organization/api-keys', redirect: '/dashboard/apikeys' },
          { path: 'organization', component: ConsoleSettingsPage },
          { path: 'organization/:pathMatch(.*)*', component: ConsoleSettingsPage },
        ],
      },
      {
        path: 'app/:appId',
        component: ConsoleAppLayout,
        children: [
          { path: 'info', component: ConsoleAppInfoPage },
          { path: 'access', component: ConsoleAppAccessPage },
          { path: '', component: ConsoleAppOverviewPage },
          { path: 'bundles', component: ConsoleBundlesPage },
          { path: 'bundles/new', component: ConsoleBundlesPage },
          { path: 'bundles/:bundle', component: ConsoleBundleDetailPage },
          { path: 'bundles/:bundle/history', component: ConsoleBundleDetailPage },
          { path: 'bundles/:bundle/manifest', component: ConsoleBundleDetailPage },
          { path: 'bundles/:bundle/dependencies', component: ConsoleBundleDetailPage },
          { path: 'bundles/:bundle/preview', component: ConsoleBundleDetailPage },
          { path: 'bundle/:bundle', component: ConsoleBundleDetailPage },
          { path: 'bundle/:bundle/history', component: ConsoleBundleDetailPage },
          { path: 'bundle/:bundle/manifest', component: ConsoleBundleDetailPage },
          { path: 'bundle/:bundle/dependencies', component: ConsoleBundleDetailPage },
          { path: 'bundle/:bundle/preview', component: ConsoleBundleDetailPage },
          { path: 'channels', component: ConsoleChannelsPage },
          { path: 'channel/:channel', component: ConsoleChannelDetailPage },
          { path: 'channel/:channel/devices', component: ConsoleChannelDetailPage },
          { path: 'channel/:channel/history', component: ConsoleChannelDetailPage },
          { path: 'channel/:channel/statistics', component: ConsoleChannelDetailPage },
          { path: 'channel/:channel/preview', component: ConsoleChannelDetailPage },
          { path: 'devices', component: ConsoleDevicesPage },
          { path: 'device/:device', component: ConsoleDeviceDetailPage },
          { path: 'device/:device/deployments', component: ConsoleDeviceDetailPage },
          { path: 'device/:device/logs', component: ConsoleDeviceDetailPage },
          { path: 'compatibility', component: ConsoleCompatibilityPage },
          { path: 'builds', component: ConsoleBuildsPage },
          { path: 'stats', redirect: route => `/app/${encodeURIComponent(String(route.params.appId))}/logs` },
          { path: 'logs', component: ConsoleStatsPage },
          { path: ':pathMatch(.*)*', component: ConsoleAppOverviewPage },
        ],
      },
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
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export function createDashboardRouter() {
  return createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: dashboardRoutes,
  })
}
