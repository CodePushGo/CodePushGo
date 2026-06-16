<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Menu,
  PackagePlus,
  RefreshCw,
  Rocket,
  Settings,
  Smartphone,
  UploadCloud,
  Users,
  X,
} from 'lucide-vue-next'
import {
  createDashboardClient,
  getCurrentSession,
  getCurrentUser,
  listAppReleases,
  listUserApps,
  normalizeBillingPeriod,
  normalizePlan,
  recordPlanIntent,
  type ConsoleAppRecord,
  type ConsoleReleaseRecord,
} from '../services/registration'

const client = createDashboardClient()
const user = ref<User | null>(null)
const apps = ref<ConsoleAppRecord[]>([])
const releases = ref<ConsoleReleaseRecord[]>([])
const selectedAppId = ref('')
const loading = ref(true)
const pending = ref(false)
const error = ref('')
const notice = ref('')
const copiedCommand = ref('')
const sidebarOpen = ref(false)
const stepsOpen = ref(false)
const stepIndex = ref(0)
const selectedPlan = ref(normalizePlan(new URLSearchParams(window.location.search).get('plan')))
const selectedBilling = ref(normalizeBillingPeriod(new URLSearchParams(window.location.search).get('billing') || new URLSearchParams(window.location.search).get('interval')))
const planRecorded = ref(false)

const selectedApp = computed(() => apps.value.find(app => app.app_id === selectedAppId.value))
const hasApps = computed(() => apps.value.length > 0)
const showSteps = computed(() => !hasApps.value || stepsOpen.value)
const displayName = computed(() => {
  const metadata = user.value?.user_metadata || {}
  const name = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ')
  return name || user.value?.email || 'Developer'
})
const firstName = computed(() => String(user.value?.user_metadata?.first_name || ''))
const lastName = computed(() => String(user.value?.user_metadata?.last_name || ''))
const latestRelease = computed(() => releases.value[0])
const monthlyDevices = computed(() => apps.value.reduce((total, app) => total + Number((app as ConsoleAppRecord & { mau?: number | null }).mau || 0), 0))
const releasesByPlatform = computed(() => releases.value.reduce<Record<string, number>>((acc, release) => {
  acc[release.platform] = (acc[release.platform] || 0) + 1
  return acc
}, {}))

const onboardingCommands = computed(() => [
  {
    title: 'Log in to the CLI',
    command: 'npx @codepushgo/cli@latest login',
    subtitle: 'Use the API key from this console when key creation is enabled.',
  },
  {
    title: 'Connect your React Native app',
    command: 'npx @codepushgo/cli@latest init',
    subtitle: 'Run it in the app folder. The CLI detects ios bundleIdentifier or Android applicationId by default.',
  },
  {
    title: 'Install the updater client',
    command: 'npm install @codepushgo/react-native-updater',
    subtitle: 'Keep the native project identity as the app id; JavaScript updates use that same id.',
  },
  {
    title: 'Bundle and upload',
    command: 'npx @codepushgo/cli@latest upload',
    subtitle: 'Build the JavaScript bundle and upload it through the Cloudflare Worker backend.',
  },
  {
    title: 'Open your dashboard',
    command: '',
    subtitle: 'This page updates when the first app and release exist in Supabase.',
  },
])

async function requireSession() {
  if (!client) {
    error.value = 'Supabase public config is missing.'
    loading.value = false
    return false
  }

  const session = await getCurrentSession(client)
  if (!session) {
    window.location.replace('/login')
    return false
  }

  user.value = await getCurrentUser(client)
  return true
}

async function refresh() {
  if (!client)
    return

  pending.value = true
  error.value = ''
  try {
    apps.value = await listUserApps(client)
    if (!selectedAppId.value || !apps.value.some(app => app.app_id === selectedAppId.value))
      selectedAppId.value = apps.value[0]?.app_id || ''
    await refreshReleases()
  }
  catch (refreshError) {
    error.value = refreshError instanceof Error ? refreshError.message : String(refreshError)
  }
  finally {
    pending.value = false
    loading.value = false
  }
}

async function refreshReleases() {
  if (!client || !selectedAppId.value) {
    releases.value = []
    return
  }
  releases.value = await listAppReleases(client, selectedAppId.value)
}

async function copyCommand(command: string, index?: number) {
  if (!command)
    return
  await navigator.clipboard.writeText(command)
  copiedCommand.value = command
  if (typeof index === 'number' && index >= stepIndex.value)
    stepIndex.value = Math.min(index + 1, onboardingCommands.value.length - 1)
  setTimeout(() => {
    if (copiedCommand.value === command)
      copiedCommand.value = ''
  }, 1800)
}

async function savePlanIntent() {
  if (!client || !user.value?.email || !user.value)
    return

  pending.value = true
  error.value = ''
  notice.value = ''
  try {
    await recordPlanIntent(client, user.value, {
      email: user.value.email,
      firstName: firstName.value,
      lastName: lastName.value,
      plan: selectedPlan.value,
      billingPeriod: selectedBilling.value,
      source: 'console_onboarding',
      metadata: {
        path: window.location.pathname,
        query: window.location.search,
      },
    })
    planRecorded.value = true
    notice.value = 'Plan intent saved for onboarding.'
  }
  catch (planError) {
    error.value = planError instanceof Error ? planError.message : String(planError)
  }
  finally {
    pending.value = false
  }
}

async function signOut() {
  if (!client)
    return
  await client.auth.signOut()
  window.location.assign('/login')
}

watch(selectedAppId, () => {
  void refreshReleases()
})

onMounted(async () => {
  if (await requireSession())
    await refresh()
})
</script>

<template>
  <main class="capgo-console-shell">
    <div class="sidebar-backdrop" :class="{ visible: sidebarOpen }" @click="sidebarOpen = false" />

    <aside class="capgo-sidebar" :class="{ open: sidebarOpen }" aria-label="Console navigation">
      <div class="sidebar-header">
        <a class="sidebar-logo" href="/app/home" aria-label="CodePushGo console">
          <span class="mark">CG</span>
          <span>CodePushGo</span>
        </a>
        <button class="sidebar-close" type="button" aria-label="Close sidebar" @click="sidebarOpen = false">
          <X :size="18" />
        </button>
      </div>

      <div class="nav-group">
        <p>Pages</p>
        <a class="active" href="/app/home">
          <BarChart3 :size="19" />
          Dashboard
        </a>
        <a href="/dashboard/apikeys">
          <KeyRound :size="19" />
          API Keys
        </a>
        <a href="/dashboard/settings/plans">
          <Settings :size="19" />
          Plans
        </a>
        <a href="https://codepushgo.com/docs/" target="_blank" rel="noreferrer">
          <BookOpen :size="19" />
          Documentation
        </a>
      </div>

      <div class="sidebar-account">
        <p>Signed in</p>
        <strong>{{ displayName }}</strong>
        <small>{{ user?.email }}</small>
        <button type="button" @click="signOut">
          <LogOut :size="16" />
          Sign out
        </button>
      </div>
    </aside>

    <section class="capgo-console-content">
      <header class="console-navbar">
        <button class="menu-button" type="button" aria-label="Open sidebar" @click="sidebarOpen = true">
          <Menu :size="20" />
        </button>
        <div class="navbar-spacer" />
        <button type="button" :disabled="pending || loading" @click="refresh">
          <RefreshCw :size="16" />
          Refresh
        </button>
        <button v-if="hasApps && !showSteps" class="primary" type="button" @click="stepsOpen = true">
          <PackagePlus :size="16" />
          Add app
        </button>
      </header>

      <p v-if="error" class="form-alert error">{{ error }}</p>
      <p v-if="notice" class="form-alert success">
        <CheckCircle2 :size="16" />
        {{ notice }}
      </p>

      <section v-if="loading" class="panel loading-panel">
        <Loader2 :size="24" class="spin" />
        Loading console
      </section>

      <template v-else-if="showSteps">
        <section class="steps-screen">
          <button v-if="hasApps" class="back-link" type="button" @click="stepsOpen = false">
            <ArrowLeft :size="16" />
            Back to dashboard
          </button>

          <div class="steps-heading">
            <h1>{{ hasApps ? 'Add another app' : 'Start using CodePushGo' }}</h1>
            <p>Connect the React Native app from its native bundle ID, then upload JavaScript bundles from the CLI.</p>
            <small>Copy each command in order. The CLI auto-detects the app identity from your iOS or Android project.</small>
          </div>

          <div class="steps-layout">
            <article class="plan-intent-card">
              <p class="eyebrow">Plan intent</p>
              <h2>Choose during onboarding</h2>
              <div class="segmented" aria-label="Billing period">
                <button :class="{ active: selectedBilling === 'monthly' }" type="button" @click="selectedBilling = 'monthly'">Monthly</button>
                <button :class="{ active: selectedBilling === 'yearly' }" type="button" @click="selectedBilling = 'yearly'">Yearly</button>
              </div>
              <div class="plan-picker compact-plan-picker" aria-label="Plan intent">
                <button type="button" :class="{ active: selectedPlan === 'trial' }" @click="selectedPlan = 'trial'">
                  <span>Trial</span>
                  <small>Validate live updates</small>
                </button>
                <button type="button" :class="{ active: selectedPlan === 'solo' }" @click="selectedPlan = 'solo'">
                  <span>Solo</span>
                  <small>One production app</small>
                </button>
                <button type="button" :class="{ active: selectedPlan === 'team' }" @click="selectedPlan = 'team'">
                  <span>Team</span>
                  <small>Shared release workflow</small>
                </button>
              </div>
              <button class="primary" type="button" :disabled="pending || planRecorded" @click="savePlanIntent">
                <CheckCircle2 :size="16" />
                {{ planRecorded ? 'Saved' : 'Save plan intent' }}
              </button>
            </article>

            <div class="capgo-steps-list">
              <template v-for="(item, index) in onboardingCommands" :key="item.title">
                <div v-if="index > 0" class="step-connector" />
                <article class="capgo-step" :class="{ muted: stepIndex !== index }">
                  <span class="capgo-step-index">{{ index < onboardingCommands.length - 1 ? index + 1 : 'GO' }}</span>
                  <div>
                    <h2>{{ item.title }}</h2>
                    <button v-if="item.command" class="command" type="button" @click="copyCommand(item.command, index)">
                      <code>{{ item.command }}</code>
                      <Copy :size="16" />
                    </button>
                    <p>{{ copiedCommand === item.command ? 'Copied to clipboard' : item.subtitle }}</p>
                  </div>
                </article>
              </template>
            </div>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="dashboard-page-head">
          <div>
            <p class="eyebrow">Dashboard</p>
            <h1>Apps</h1>
          </div>
          <button class="primary" type="button" @click="copyCommand('npx @codepushgo/cli@latest upload')">
            <UploadCloud :size="16" />
            Upload command
          </button>
        </section>

        <section class="dashboard-grid">
          <article class="metric-card usage-card">
            <div>
              <p>Usage</p>
              <strong>{{ monthlyDevices }}</strong>
              <span>monthly active devices</span>
            </div>
            <Smartphone :size="24" />
          </article>
          <article class="metric-card">
            <div>
              <p>Apps</p>
              <strong>{{ apps.length }}</strong>
              <span>connected bundle IDs</span>
            </div>
            <PackagePlus :size="24" />
          </article>
          <article class="metric-card">
            <div>
              <p>Latest release</p>
              <strong>{{ latestRelease?.version || '-' }}</strong>
              <span>{{ latestRelease?.channel || 'no release yet' }}</span>
            </div>
            <Rocket :size="24" />
          </article>
        </section>

        <section class="console-table-card top-apps-card">
          <header>
            <h2>Top apps</h2>
            <span>{{ apps.length }}</span>
          </header>
          <div class="table-scroll">
            <table aria-label="Table with your apps">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Native bundle ID</th>
                  <th>Releases</th>
                  <th>iOS</th>
                  <th>Android</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="app in apps"
                  :key="app.app_id"
                  class="app-table-row"
                  :class="{ active: app.app_id === selectedAppId }"
                  @click="selectedAppId = app.app_id"
                >
                  <td>
                    <div class="app-name-cell">
                      <span class="app-icon">{{ app.name.slice(0, 2).toUpperCase() }}</span>
                      <strong>{{ app.name }}</strong>
                    </div>
                  </td>
                  <td><code>{{ app.app_id }}</code></td>
                  <td>{{ app.app_id === selectedAppId ? releases.length : '-' }}</td>
                  <td>{{ app.app_id === selectedAppId ? (releasesByPlatform.ios || 0) : '-' }}</td>
                  <td>{{ app.app_id === selectedAppId ? (releasesByPlatform.android || 0) : '-' }}</td>
                  <td>{{ app.created_at ? new Date(app.created_at).toLocaleDateString() : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="console-table-card releases-card">
          <header>
            <div>
              <p class="eyebrow">{{ selectedApp?.app_id }}</p>
              <h2>{{ selectedApp?.name || 'Releases' }}</h2>
            </div>
            <button type="button" :disabled="pending || !selectedAppId" @click="refreshReleases">
              <RefreshCw :size="16" />
              Reload
            </button>
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
                  <td>{{ release.created_at ? new Date(release.created_at).toLocaleString() : '-' }}</td>
                </tr>
                <tr v-if="releases.length === 0">
                  <td colspan="6" class="empty">No releases yet for this native bundle ID.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="console-table-card shared-apps-card">
          <header>
            <h2>Shared apps</h2>
            <Users :size="18" />
          </header>
          <p class="empty-state">Shared release access will appear here when another organization grants access to one of your users.</p>
        </section>
      </template>
    </section>
  </main>
</template>
