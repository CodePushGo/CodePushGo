<script setup lang="ts">
import { onMounted } from 'vue'
import { CheckCircle2, Copy, Loader2 } from 'lucide-vue-next'
import Steps from '../components/onboarding/Steps.vue'
import ConsoleLayout from '../layouts/ConsoleLayout.vue'
import { useConsoleStore } from '../stores/console'
import ConsoleApiKeysPage from './console/ConsoleApiKeysPage.vue'
import ConsoleAppOverviewPage from './console/ConsoleAppOverviewPage.vue'
import ConsoleBundlesPage from './console/ConsoleBundlesPage.vue'
import ConsoleChannelsPage from './console/ConsoleChannelsPage.vue'
import ConsoleDevicesPage from './console/ConsoleDevicesPage.vue'
import ConsoleHomePage from './console/ConsoleHomePage.vue'
import ConsoleSettingsPage from './console/ConsoleSettingsPage.vue'
import ConsoleStatsPage from './console/ConsoleStatsPage.vue'
const consoleStore = useConsoleStore()
const {
  appMenuOpen,
  apps,
  copyCommand,
  copiedCommand,
  displayName,
  error,
  loading,
  navigate,
  notice,
  onboardingCommands,
  pageEyebrow,
  pageTitle,
  pending,
  planRecorded,
  refresh,
  releaseCommand,
  savePlanIntent,
  section,
  selectedApp,
  selectedAppId,
  selectedBilling,
  selectedPlan,
  showOnboarding,
  sidebarOpen,
  signOut,
  uploadCommand,
  user,
} = consoleStore

onMounted(async () => {
  window.addEventListener('popstate', () => {
    consoleStore.syncPath()
  })
  await consoleStore.mount()
})
</script>

<template>
  <ConsoleLayout
    :apps="apps"
    :current-section="section"
    :selected-app-id="selectedAppId"
    :sidebar-open="sidebarOpen"
    :app-menu-open="appMenuOpen"
    :display-name="displayName"
    :email="user?.email"
    :pending="pending"
    :loading="loading"
    :title="pageTitle"
    :eyebrow="pageEyebrow"
    @close-sidebar="sidebarOpen = false"
    @toggle-sidebar="sidebarOpen = !sidebarOpen"
    @toggle-app-menu="appMenuOpen = !appMenuOpen"
    @navigate="navigate"
    @sign-out="signOut"
    @refresh="refresh"
    @upload="copyCommand(uploadCommand)"
  >
    <p v-if="error" class="form-alert error">{{ error }}</p>
    <p v-if="notice" class="form-alert success">
      <CheckCircle2 :size="16" />
      {{ notice }}
    </p>

    <section v-if="loading" class="panel loading-panel">
      <Loader2 :size="24" class="spin" />
      Loading console
    </section>

    <Steps
      v-else-if="showOnboarding"
      :steps="onboardingCommands"
      :copied-command="copiedCommand"
      :selected-plan="selectedPlan"
      :selected-billing="selectedBilling"
      :pending="pending"
      :plan-recorded="planRecorded"
      @copy-command="copyCommand"
      @save-plan-intent="savePlanIntent"
      @update-selected-plan="selectedPlan = $event"
      @update-selected-billing="selectedBilling = $event"
    />

    <template v-else>
      <section class="dashboard-page-head">
        <div>
          <p class="eyebrow">{{ selectedApp?.app_id || 'Organization' }}</p>
          <h1>{{ pageTitle }}</h1>
          <p v-if="section === 'home'">Manage the React Native apps connected by native bundle ID.</p>
          <p v-else-if="section === 'api-keys'">Use organization API keys with the CLI and Cloudflare Worker endpoints.</p>
          <p v-else-if="section === 'settings'">Billing, plan intent, team access, and organization defaults.</p>
          <p v-else>Manage React Native JavaScript bundles, channels, devices, and update stats.</p>
        </div>
        <button class="primary" type="button" @click="copyCommand(section === 'releases' ? uploadCommand : releaseCommand)">
          <Copy :size="16" />
          {{ copiedCommand ? 'Copied' : 'Copy CLI command' }}
        </button>
      </section>

      <ConsoleHomePage v-if="section === 'home'" />
      <ConsoleAppOverviewPage v-else-if="section === 'overview'" />
      <ConsoleBundlesPage v-else-if="section === 'releases'" />

      <ConsoleChannelsPage v-else-if="section === 'channels'" />
      <ConsoleDevicesPage v-else-if="section === 'devices'" />
      <ConsoleStatsPage v-else-if="section === 'stats'" />
      <ConsoleApiKeysPage v-else-if="section === 'api-keys'" />
      <ConsoleSettingsPage v-else-if="section === 'settings'" />
    </template>
  </ConsoleLayout>
</template>
