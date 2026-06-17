<script setup lang="ts">
import { onMounted } from 'vue'
import { Activity, CheckCircle2, Copy, Loader2, RadioTower, ShieldCheck, Smartphone, UploadCloud, Users } from 'lucide-vue-next'
import TopApps from '../components/dashboard/TopApps.vue'
import Usage from '../components/dashboard/Usage.vue'
import WelcomeBanner from '../components/dashboard/WelcomeBanner.vue'
import Steps from '../components/onboarding/Steps.vue'
import ConsoleLayout from '../layouts/ConsoleLayout.vue'
import { useConsoleStore } from '../stores/console'

const consoleStore = useConsoleStore()
const {
  appMenuOpen,
  appStats,
  apps,
  channels,
  copyCommand,
  copiedCommand,
  devices,
  displayName,
  error,
  firstName,
  latestRelease,
  initCommand,
  loading,
  monthlyDevices,
  navigate,
  notice,
  onboardingCommands,
  pageEyebrow,
  pageTitle,
  pending,
  planRecorded,
  refresh,
  releaseCommand,
  releases,
  releasesByPlatform,
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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

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

      <section v-if="section === 'home'" class="dashboard-content">
        <WelcomeBanner :name="firstName || displayName" />
        <div class="dashboard-home-grid">
          <TopApps :apps="apps" :selected-app-id="selectedAppId" @open-app="navigate('overview', $event)" />
          <article class="quickstart-card">
            <p class="eyebrow">Add app</p>
            <h2>Let the CLI detect the bundle ID</h2>
            <button class="command" type="button" @click="copyCommand(initCommand)">
              <code>{{ initCommand }}</code>
              <Copy :size="16" />
            </button>
            <p>Do not create a separate CodePushGo identifier. The app id is the React Native native bundle ID.</p>
          </article>
        </div>
      </section>

      <template v-else-if="section === 'overview'">
        <Usage
          :devices="monthlyDevices"
          :bundles="releases.length"
          :ios-bundles="releasesByPlatform.ios || 0"
          :android-bundles="releasesByPlatform.android || 0"
          :latest-version="latestRelease?.version"
          :latest-channel="latestRelease?.channel"
        />

        <section class="dashboard-home-grid dashboard-content compact-content">
          <article class="console-table-card">
            <header>
              <h2>Latest bundles</h2>
              <button type="button" @click="navigate('releases')">View all</button>
            </header>
            <div class="release-feed">
              <div v-for="release in releases.slice(0, 5)" :key="`${release.app_id}-${release.platform}-${release.channel}-${release.version}`" class="release-feed-row">
                <span class="status-dot" />
                <div>
                  <strong>{{ release.version }}</strong>
                  <small>{{ release.platform }} / {{ release.channel }} / rollout {{ release.rollout ?? 100 }}%</small>
                </div>
                <span>{{ formatDate(release.created_at) }}</span>
              </div>
              <p v-if="releases.length === 0" class="empty-state">No JavaScript bundle uploaded yet.</p>
            </div>
          </article>

          <article class="quickstart-card">
            <p class="eyebrow">Install snippet</p>
            <h2>Start updates from JavaScript</h2>
            <pre><code>import { startCodePushGo } from '@codepushgo/react-native-updater'

startCodePushGo()</code></pre>
            <p>The updater auto-connects with the native bundle ID exposed by React Native.</p>
          </article>
        </section>
      </template>

      <section v-else-if="section === 'releases'" class="dashboard-content console-table-card">
        <header>
          <h2>Bundles</h2>
          <button type="button" @click="copyCommand(uploadCommand)"><UploadCloud :size="16" /> Upload command</button>
        </header>
        <div class="table-scroll">
          <table aria-label="Release table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Platform</th>
                <th>Channel</th>
                <th>Rollout</th>
                <th>Size</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="release in releases" :key="`${release.app_id}-${release.platform}-${release.channel}-${release.version}`">
                <td>{{ release.version }}</td>
                <td>{{ release.platform }}</td>
                <td>{{ release.channel }}</td>
                <td>{{ release.rollout ?? 100 }}%</td>
                <td>{{ release.size ? `${Math.round(release.size / 1024)} KB` : '-' }}</td>
                <td>{{ formatDate(release.created_at) }}</td>
              </tr>
              <tr v-if="releases.length === 0">
                <td colspan="6" class="empty">No releases yet for this native bundle ID.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="section === 'channels'" class="dashboard-content console-table-card">
        <header>
          <h2>Channels</h2>
          <RadioTower :size="18" />
        </header>
        <div class="table-scroll">
          <table aria-label="Channels table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Platforms</th>
                <th>Public</th>
                <th>Self set</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="channel in channels" :key="`${channel.app_id}-${channel.name}`">
                <td>{{ channel.name }}</td>
                <td>{{ [channel.ios ? 'iOS' : '', channel.android ? 'Android' : '', channel.electron ? 'Electron' : ''].filter(Boolean).join(' / ') || '-' }}</td>
                <td>{{ channel.public ? 'Yes' : 'No' }}</td>
                <td>{{ channel.allow_self_set ? 'Yes' : 'No' }}</td>
                <td>{{ formatDate(channel.updated_at || channel.created_at) }}</td>
              </tr>
              <tr v-if="channels.length === 0">
                <td colspan="5" class="empty">No channel rows yet. Upload and release a bundle to create production.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="section === 'devices'" class="dashboard-content console-table-card">
        <header>
          <h2>Devices</h2>
          <Smartphone :size="18" />
        </header>
        <div class="table-scroll">
          <table aria-label="Devices table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Platform</th>
                <th>Default channel</th>
                <th>Bundle</th>
                <th>Plugin</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="device in devices" :key="device.device_id || `${device.platform}-${device.updated_at}`">
                <td>{{ device.device_id || device.custom_id || '-' }}</td>
                <td>{{ device.platform || '-' }}</td>
                <td>{{ device.default_channel || '-' }}</td>
                <td>{{ device.version_name || '-' }}</td>
                <td>{{ device.plugin_version || '-' }}</td>
                <td>{{ formatDate(device.updated_at) }}</td>
              </tr>
              <tr v-if="devices.length === 0">
                <td colspan="6" class="empty">No devices have checked for updates yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="section === 'stats'" class="dashboard-content console-table-card">
        <header>
          <h2>Stats</h2>
          <Activity :size="18" />
        </header>
        <div class="table-scroll">
          <table aria-label="Stats table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Version</th>
                <th>Platform</th>
                <th>Device</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in appStats" :key="`${stat.action}-${stat.device_id}-${stat.created_at}`">
                <td>{{ stat.action || '-' }}</td>
                <td>{{ stat.version_name || '-' }}</td>
                <td>{{ stat.platform || '-' }}</td>
                <td>{{ stat.device_id || '-' }}</td>
                <td>{{ formatDate(stat.created_at) }}</td>
              </tr>
              <tr v-if="appStats.length === 0">
                <td colspan="5" class="empty">No update stats have been recorded yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="section === 'api-keys'" class="dashboard-home-grid dashboard-content compact-content">
        <article class="quickstart-card">
          <p class="eyebrow">CLI authentication</p>
          <h2>Create an organization API key</h2>
          <p>Admin endpoints require <code>Authorization: Bearer &lt;CODEPUSHGO_API_KEY&gt;</code>. Use the key with the CLI for bundle uploads and release operations.</p>
          <button class="command" type="button" @click="copyCommand('npx @codepushgo/cli@latest login')">
            <code>npx @codepushgo/cli@latest login</code>
            <Copy :size="16" />
          </button>
        </article>
        <article class="quickstart-card muted-card">
          <ShieldCheck :size="24" />
          <h2>Supabase auth, Worker API</h2>
          <p>User sessions stay in Supabase Auth. Runtime update traffic goes to the Cloudflare Worker, not Supabase Edge Functions.</p>
        </article>
      </section>

      <section v-else-if="section === 'settings'" class="dashboard-home-grid dashboard-content compact-content">
        <article class="plan-intent-card static-plan-card">
          <p class="eyebrow">Plan intent</p>
          <h2>Record the onboarding choice</h2>
          <div class="segmented" aria-label="Billing period">
            <button :class="{ active: selectedBilling === 'monthly' }" type="button" @click="selectedBilling = 'monthly'">Monthly</button>
            <button :class="{ active: selectedBilling === 'yearly' }" type="button" @click="selectedBilling = 'yearly'">Yearly</button>
          </div>
          <div class="plan-picker compact-plan-picker" aria-label="Plan intent">
            <button type="button" :class="{ active: selectedPlan === 'trial' }" @click="selectedPlan = 'trial'"><span>Trial</span><small>Validate live updates</small></button>
            <button type="button" :class="{ active: selectedPlan === 'solo' }" @click="selectedPlan = 'solo'"><span>Solo</span><small>One production app</small></button>
            <button type="button" :class="{ active: selectedPlan === 'team' }" @click="selectedPlan = 'team'"><span>Team</span><small>Shared release workflow</small></button>
          </div>
          <button class="primary" type="button" :disabled="pending || planRecorded" @click="savePlanIntent">
            <CheckCircle2 :size="16" />
            {{ planRecorded ? 'Saved' : 'Save plan intent' }}
          </button>
        </article>
        <article class="quickstart-card muted-card">
          <Users :size="24" />
          <h2>Team settings</h2>
          <p>Organization members, roles, and billing configuration will appear here as the Supabase migration tables are populated.</p>
        </article>
      </section>
    </template>
  </ConsoleLayout>
</template>
