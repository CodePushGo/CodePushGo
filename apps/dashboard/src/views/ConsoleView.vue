<script setup lang="ts">
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { computed, onMounted, ref, watch } from 'vue'
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Copy,
  Gauge,
  KeyRound,
  Layers3,
  Loader2,
  LogOut,
  Menu,
  PackagePlus,
  RadioTower,
  RefreshCw,
  Rocket,
  Settings,
  ShieldCheck,
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

interface ChannelRow {
  id?: number | string
  name: string
  version?: string | null
  version_id?: number | string | null
  public?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

interface DeviceRow {
  device_id?: string | null
  platform?: string | null
  channel?: string | null
  version?: string | null
  app_id?: string | null
  updated_at?: string | null
}

interface AppStatRow {
  app_id?: string | null
  version?: string | null
  platform?: string | null
  action?: string | null
  device_id?: string | null
  created_at?: string | null
}

type ConsoleSection = 'home' | 'overview' | 'releases' | 'channels' | 'devices' | 'stats' | 'api-keys' | 'settings'

const client = createDashboardClient()
const user = ref<User | null>(null)
const apps = ref<ConsoleAppRecord[]>([])
const releases = ref<ConsoleReleaseRecord[]>([])
const channels = ref<ChannelRow[]>([])
const devices = ref<DeviceRow[]>([])
const appStats = ref<AppStatRow[]>([])
const selectedAppId = ref('')
const loading = ref(true)
const pending = ref(false)
const error = ref('')
const notice = ref('')
const copiedCommand = ref('')
const sidebarOpen = ref(false)
const appMenuOpen = ref(false)
const selectedPlan = ref(normalizePlan(new URLSearchParams(window.location.search).get('plan')))
const selectedBilling = ref(normalizeBillingPeriod(new URLSearchParams(window.location.search).get('billing') || new URLSearchParams(window.location.search).get('interval')))
const planRecorded = ref(false)

function pathSection(pathname = window.location.pathname): ConsoleSection {
  if (pathname.includes('/apikey') || pathname.includes('/api-key'))
    return 'api-keys'
  if (pathname.includes('/setting') || pathname.includes('/plans'))
    return 'settings'
  if (pathname.includes('/channel'))
    return 'channels'
  if (pathname.includes('/device'))
    return 'devices'
  if (pathname.includes('/stat') || pathname.includes('/analytic'))
    return 'stats'
  if (pathname.includes('/bundle') || pathname.includes('/release'))
    return 'releases'
  if (pathname === '/' || pathname.includes('/app/home') || pathname === '/dashboard')
    return 'home'
  return 'overview'
}

function appIdFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/\/app\/p\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

const section = ref<ConsoleSection>(pathSection())
const routeAppId = appIdFromPath()
const selectedApp = computed(() => apps.value.find(app => app.app_id === selectedAppId.value))
const hasApps = computed(() => apps.value.length > 0)
const showOnboarding = computed(() => !loading.value && !hasApps.value)
const isAppScoped = computed(() => section.value !== 'home' && section.value !== 'api-keys' && section.value !== 'settings')
const pageTitle = computed(() => {
  if (showOnboarding.value)
    return 'Onboarding'
  if (section.value === 'home')
    return 'All apps'
  if (section.value === 'api-keys')
    return 'API keys'
  if (section.value === 'settings')
    return 'Organization settings'
  const titles: Record<ConsoleSection, string> = {
    home: 'All apps',
    overview: 'Overview',
    releases: 'Bundles',
    channels: 'Channels',
    devices: 'Devices',
    stats: 'Stats',
    'api-keys': 'API keys',
    settings: 'Settings',
  }
  return titles[section.value]
})
const displayName = computed(() => {
  const metadata = user.value?.user_metadata || {}
  const name = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ')
  return name || user.value?.email || 'Developer'
})
const firstName = computed(() => String(user.value?.user_metadata?.first_name || ''))
const lastName = computed(() => String(user.value?.user_metadata?.last_name || ''))
const latestRelease = computed(() => releases.value[0])
const monthlyDevices = computed(() => new Set([...devices.value.map(device => device.device_id).filter(Boolean), ...appStats.value.map(stat => stat.device_id).filter(Boolean)]).size)
const releasesByPlatform = computed(() => releases.value.reduce<Record<string, number>>((acc, release) => {
  acc[release.platform] = (acc[release.platform] || 0) + 1
  return acc
}, {}))
const installCommand = computed(() => 'npm install @codepushgo/react-native-updater')
const initCommand = computed(() => 'npx @codepushgo/cli@latest init')
const uploadCommand = computed(() => selectedAppId.value ? `npx @codepushgo/cli@latest upload --app-id ${selectedAppId.value}` : 'npx @codepushgo/cli@latest upload')
const releaseCommand = computed(() => selectedAppId.value ? `npx @codepushgo/cli@latest release --app-id ${selectedAppId.value} --channel production` : 'npx @codepushgo/cli@latest release --channel production')
const sidebarAppLinks = computed(() => selectedAppId.value
  ? [
      { section: 'overview' as const, label: 'Overview', href: `/app/p/${encodeURIComponent(selectedAppId.value)}`, icon: BarChart3 },
      { section: 'releases' as const, label: 'Bundles', href: `/app/p/${encodeURIComponent(selectedAppId.value)}/bundle`, icon: Layers3 },
      { section: 'channels' as const, label: 'Channels', href: `/app/p/${encodeURIComponent(selectedAppId.value)}/channels`, icon: RadioTower },
      { section: 'devices' as const, label: 'Devices', href: `/app/p/${encodeURIComponent(selectedAppId.value)}/devices`, icon: Smartphone },
      { section: 'stats' as const, label: 'Stats', href: `/app/p/${encodeURIComponent(selectedAppId.value)}/stats`, icon: Gauge },
    ]
  : [])

const onboardingCommands = computed(() => [
  {
    title: 'Install the React Native updater',
    command: installCommand.value,
    subtitle: 'Add the JavaScript updater client. Native build support stays out of scope for this MVP.',
  },
  {
    title: 'Connect the native bundle ID',
    command: initCommand.value,
    subtitle: 'Run this inside the React Native project. The CLI detects ios.bundleIdentifier or android.applicationId by default.',
  },
  {
    title: 'Upload the first JavaScript bundle',
    command: uploadCommand.value,
    subtitle: 'The upload goes through the Cloudflare Worker and records the release against the same bundle ID.',
  },
  {
    title: 'Promote to production',
    command: releaseCommand.value,
    subtitle: 'Channels, rollbacks, rollout, and device assignment work from the console once the release exists.',
  },
])

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function appHref(appId: string, target: ConsoleSection = 'overview') {
  const encoded = encodeURIComponent(appId)
  if (target === 'releases')
    return `/app/p/${encoded}/bundle`
  if (target === 'channels')
    return `/app/p/${encoded}/channels`
  if (target === 'devices')
    return `/app/p/${encoded}/devices`
  if (target === 'stats')
    return `/app/p/${encoded}/stats`
  return `/app/p/${encoded}`
}

function navigate(target: ConsoleSection, appId = selectedAppId.value) {
  section.value = target
  if (appId)
    selectedAppId.value = appId
  const href = target === 'home' ? '/app/home' : target === 'api-keys' ? '/dashboard/apikeys' : target === 'settings' ? '/dashboard/settings/plans' : appHref(appId, target)
  window.history.pushState({}, '', href)
  sidebarOpen.value = false
  appMenuOpen.value = false
}

async function safeSelect<T>(clientRef: SupabaseClient, table: string, query: (table: ReturnType<SupabaseClient['from']>) => PromiseLike<{ data: unknown, error: unknown }>) {
  try {
    const { data, error: queryError } = await query(clientRef.from(table))
    if (queryError)
      return [] as T[]
    return (data ?? []) as T[]
  }
  catch {
    return [] as T[]
  }
}

async function requireSession() {
  if (!client) {
    error.value = 'Supabase public config is missing for console.codepushgo.com.'
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
    const preferred = routeAppId || selectedAppId.value
    if (preferred && apps.value.some(app => app.app_id === preferred))
      selectedAppId.value = preferred
    else if (!selectedAppId.value || !apps.value.some(app => app.app_id === selectedAppId.value))
      selectedAppId.value = apps.value[0]?.app_id || ''
    await refreshAppData()
  }
  catch (refreshError) {
    error.value = refreshError instanceof Error ? refreshError.message : String(refreshError)
  }
  finally {
    pending.value = false
    loading.value = false
  }
}

async function refreshAppData() {
  if (!client || !selectedAppId.value) {
    releases.value = []
    channels.value = []
    devices.value = []
    appStats.value = []
    return
  }

  releases.value = await listAppReleases(client, selectedAppId.value)
  channels.value = await safeSelect<ChannelRow>(client, 'channels', table => table
    .select('id,name,version,version_id,public,created_at,updated_at')
    .eq('app_id', selectedAppId.value)
    .order('updated_at', { ascending: false }) as never)
  devices.value = await safeSelect<DeviceRow>(client, 'channel_devices', table => table
    .select('device_id,platform,channel,version,app_id,updated_at')
    .eq('app_id', selectedAppId.value)
    .order('updated_at', { ascending: false })
    .limit(50) as never)
  appStats.value = await safeSelect<AppStatRow>(client, 'stats', table => table
    .select('app_id,version,platform,action,device_id,created_at')
    .eq('app_id', selectedAppId.value)
    .order('created_at', { ascending: false })
    .limit(100) as never)
}

async function copyCommand(command: string) {
  if (!command)
    return
  await navigator.clipboard.writeText(command)
  copiedCommand.value = command
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
        selectedAppId: selectedAppId.value || null,
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
  void refreshAppData()
})

onMounted(async () => {
  window.addEventListener('popstate', () => {
    section.value = pathSection()
  })
  if (await requireSession())
    await refresh()
})
</script>

<template>
  <main class="capgo-console-shell">
    <div class="sidebar-backdrop" :class="{ visible: sidebarOpen }" @click="sidebarOpen = false" />

    <aside class="capgo-sidebar" :class="{ open: sidebarOpen }" aria-label="Console navigation">
      <div class="sidebar-header">
        <a class="sidebar-logo" href="/app/home" aria-label="CodePushGo console" @click.prevent="navigate('home')">
          <span class="mark">CG</span>
          <span>CodePushGo</span>
        </a>
        <button class="sidebar-close" type="button" aria-label="Close sidebar" @click="sidebarOpen = false">
          <X :size="18" />
        </button>
      </div>

      <div class="app-switcher" :class="{ disabled: !hasApps }">
        <button type="button" :disabled="!hasApps" @click="appMenuOpen = !appMenuOpen">
          <span class="app-icon">{{ selectedApp?.name?.slice(0, 2).toUpperCase() || 'RN' }}</span>
          <span>
            <strong>{{ selectedApp?.name || 'No app yet' }}</strong>
            <small>{{ selectedApp?.app_id || 'React Native bundle ID' }}</small>
          </span>
          <ChevronDown :size="16" />
        </button>
        <div v-if="appMenuOpen" class="app-switcher-menu">
          <button v-for="app in apps" :key="app.app_id" type="button" @click="navigate('overview', app.app_id)">
            <span class="app-icon">{{ app.name.slice(0, 2).toUpperCase() }}</span>
            <span>
              <strong>{{ app.name }}</strong>
              <small>{{ app.app_id }}</small>
            </span>
          </button>
        </div>
      </div>

      <div class="nav-group">
        <p>Console</p>
        <a href="/app/home" :class="{ active: section === 'home' }" @click.prevent="navigate('home')">
          <PackagePlus :size="19" />
          All apps
        </a>
        <a v-for="item in sidebarAppLinks" :key="item.section" :href="item.href" :class="{ active: section === item.section }" @click.prevent="navigate(item.section)">
          <component :is="item.icon" :size="19" />
          {{ item.label }}
        </a>
      </div>

      <div class="nav-group">
        <p>Organization</p>
        <a href="/dashboard/apikeys" :class="{ active: section === 'api-keys' }" @click.prevent="navigate('api-keys')">
          <KeyRound :size="19" />
          API keys
        </a>
        <a href="/dashboard/settings/plans" :class="{ active: section === 'settings' }" @click.prevent="navigate('settings')">
          <Settings :size="19" />
          Settings
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
        <div class="breadcrumb">
          <span>{{ isAppScoped ? selectedApp?.name || 'App' : 'CodePushGo' }}</span>
          <strong>{{ pageTitle }}</strong>
        </div>
        <div class="navbar-spacer" />
        <button type="button" :disabled="pending || loading" @click="refresh">
          <RefreshCw :size="16" />
          Refresh
        </button>
        <button class="primary" type="button" @click="copyCommand(uploadCommand)">
          <UploadCloud :size="16" />
          Upload
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

      <template v-else-if="showOnboarding">
        <section class="capgo-page-head onboarding-title">
          <div>
            <p class="eyebrow">React Native onboarding</p>
            <h1>Connect your first app with its native bundle ID</h1>
            <p>CodePushGo uses the same app identity as the React Native native project. Run the CLI in the project and the console will fill with apps, bundles, channels, devices, and stats.</p>
          </div>
        </section>

        <section class="steps-layout capgo-page-section">
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
            <article v-for="(item, index) in onboardingCommands" :key="item.title" class="capgo-step">
              <span class="capgo-step-index">{{ index + 1 }}</span>
              <div>
                <h2>{{ item.title }}</h2>
                <button class="command" type="button" @click="copyCommand(item.command)">
                  <code>{{ item.command }}</code>
                  <Copy :size="16" />
                </button>
                <p>{{ copiedCommand === item.command ? 'Copied to clipboard' : item.subtitle }}</p>
              </div>
            </article>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="capgo-page-head">
          <div>
            <p class="eyebrow">{{ selectedApp?.app_id || 'Organization' }}</p>
            <h1>{{ pageTitle }}</h1>
            <p v-if="section === 'home'">Manage the React Native apps connected by native bundle ID.</p>
            <p v-else-if="section === 'api-keys'">Use organization API keys with the CLI and Cloudflare Worker endpoints.</p>
            <p v-else-if="section === 'settings'">Billing, plan intent, team access, and organization defaults.</p>
            <p v-else>Capgo-style release operations adapted to React Native JavaScript bundles.</p>
          </div>
          <button class="primary" type="button" @click="copyCommand(section === 'releases' ? uploadCommand : releaseCommand)">
            <Copy :size="16" />
            {{ copiedCommand ? 'Copied' : 'Copy CLI command' }}
          </button>
        </section>

        <section v-if="section === 'home'" class="capgo-page-section apps-overview-layout">
          <article class="console-table-card apps-card-main">
            <header>
              <h2>Apps</h2>
              <span>{{ apps.length }}</span>
            </header>
            <div class="app-list">
              <button v-for="app in apps" :key="app.app_id" type="button" class="app-list-row" @click="navigate('overview', app.app_id)">
                <span class="app-icon">{{ app.name.slice(0, 2).toUpperCase() }}</span>
                <span>
                  <strong>{{ app.name }}</strong>
                  <small>{{ app.app_id }}</small>
                </span>
                <span>{{ formatDate(app.created_at) }}</span>
              </button>
            </div>
          </article>

          <article class="quickstart-card">
            <p class="eyebrow">Add app</p>
            <h2>Let the CLI detect the bundle ID</h2>
            <button class="command" type="button" @click="copyCommand(initCommand)">
              <code>{{ initCommand }}</code>
              <Copy :size="16" />
            </button>
            <p>Do not create a separate CodePushGo identifier. The app id is the React Native native bundle ID.</p>
          </article>
        </section>

        <section v-else-if="section === 'overview'" class="capgo-page-section dashboard-grid">
          <article class="metric-card usage-card">
            <div>
              <p>Devices</p>
              <strong>{{ monthlyDevices }}</strong>
              <span>recent active devices</span>
            </div>
            <Smartphone :size="24" />
          </article>
          <article class="metric-card">
            <div>
              <p>Bundles</p>
              <strong>{{ releases.length }}</strong>
              <span>{{ releasesByPlatform.ios || 0 }} iOS / {{ releasesByPlatform.android || 0 }} Android</span>
            </div>
            <Layers3 :size="24" />
          </article>
          <article class="metric-card">
            <div>
              <p>Latest</p>
              <strong>{{ latestRelease?.version || '-' }}</strong>
              <span>{{ latestRelease?.channel || 'no release yet' }}</span>
            </div>
            <Rocket :size="24" />
          </article>
        </section>

        <section v-if="section === 'overview'" class="capgo-page-section two-column-layout">
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

        <section v-else-if="section === 'releases'" class="capgo-page-section console-table-card">
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

        <section v-else-if="section === 'channels'" class="capgo-page-section console-table-card">
          <header>
            <h2>Channels</h2>
            <RadioTower :size="18" />
          </header>
          <div class="table-scroll">
            <table aria-label="Channels table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Bundle</th>
                  <th>Public</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="channel in channels" :key="channel.id || channel.name">
                  <td>{{ channel.name }}</td>
                  <td>{{ channel.version || channel.version_id || '-' }}</td>
                  <td>{{ channel.public ? 'Yes' : 'No' }}</td>
                  <td>{{ formatDate(channel.updated_at || channel.created_at) }}</td>
                </tr>
                <tr v-if="channels.length === 0">
                  <td colspan="4" class="empty">No channel rows yet. Upload and release a bundle to create production.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-else-if="section === 'devices'" class="capgo-page-section console-table-card">
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
                  <th>Channel</th>
                  <th>Bundle</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="device in devices" :key="device.device_id || `${device.platform}-${device.updated_at}`">
                  <td>{{ device.device_id || '-' }}</td>
                  <td>{{ device.platform || '-' }}</td>
                  <td>{{ device.channel || '-' }}</td>
                  <td>{{ device.version || '-' }}</td>
                  <td>{{ formatDate(device.updated_at) }}</td>
                </tr>
                <tr v-if="devices.length === 0">
                  <td colspan="5" class="empty">No devices have checked for updates yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-else-if="section === 'stats'" class="capgo-page-section console-table-card">
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
                  <td>{{ stat.version || '-' }}</td>
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

        <section v-else-if="section === 'api-keys'" class="capgo-page-section two-column-layout">
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

        <section v-else-if="section === 'settings'" class="capgo-page-section two-column-layout">
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
    </section>
  </main>
</template>
