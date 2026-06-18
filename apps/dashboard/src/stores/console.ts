import type { SupabaseClient, User } from '@supabase/supabase-js'
import { computed, ref, watch } from 'vue'
import { appHref, appIdFromPath, consoleSectionTitle, pathSection, type ConsoleSection } from '../services/consoleRoute'
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

export interface ChannelRow {
  app_id?: string | null
  name: string
  public?: boolean | null
  allow_self_set?: boolean | null
  ios?: boolean | null
  android?: boolean | null
  electron?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

export interface DeviceRow {
  app_id?: string | null
  device_id?: string | null
  platform?: string | null
  plugin_version?: string | null
  version_name?: string | null
  custom_id?: string | null
  default_channel?: string | null
  updated_at?: string | null
}
export interface DeviceChannelRow {
  app_id?: string | null
  device_id: string
  channel: string
  created_at?: string | null
  updated_at?: string | null
}


export interface AppStatRow {
  app_id?: string | null
  version_name?: string | null
  platform?: string | null
  action?: string | null
  device_id?: string | null
  created_at?: string | null
}

export interface ConsoleStoreDeps {
  client?: SupabaseClient | null
  location?: Pick<Location, 'pathname' | 'search'>
  history?: Pick<History, 'pushState'>
  navigator?: Pick<Navigator, 'clipboard'>
  setTimeout?: typeof setTimeout
  redirect?: (href: string) => void
}

function defaultDeps(): Required<ConsoleStoreDeps> {
  const browserWindow = typeof window === 'undefined' ? undefined : window
  return {
    client: createDashboardClient(),
    location: browserWindow?.location ?? { pathname: '/', search: '' } as Location,
    history: browserWindow?.history ?? { pushState() {} } as unknown as History,
    navigator: browserWindow?.navigator ?? { clipboard: { async writeText() {} } } as unknown as Navigator,
    setTimeout: browserWindow?.setTimeout.bind(browserWindow) ?? setTimeout,
    redirect: href => browserWindow?.location.assign(href),
  }
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

export function createConsoleStore(inputDeps: ConsoleStoreDeps = {}) {
  const deps = { ...defaultDeps(), ...inputDeps }
  const client = deps.client
  const user = ref<User | null>(null)
  const apps = ref<ConsoleAppRecord[]>([])
  const releases = ref<ConsoleReleaseRecord[]>([])
  const channels = ref<ChannelRow[]>([])
  const devices = ref<DeviceRow[]>([])
  const deviceChannels = ref<DeviceChannelRow[]>([])
  const appStats = ref<AppStatRow[]>([])
  const selectedAppId = ref('')
  const loading = ref(true)
  const pending = ref(false)
  const error = ref('')
  const notice = ref('')
  const copiedCommand = ref('')
  const sidebarOpen = ref(false)
  const appMenuOpen = ref(false)
  const selectedPlan = ref(normalizePlan(new URLSearchParams(deps.location.search).get('plan')))
  const selectedBilling = ref(normalizeBillingPeriod(new URLSearchParams(deps.location.search).get('billing') || new URLSearchParams(deps.location.search).get('interval')))
  const planRecorded = ref(false)
  const section = ref<ConsoleSection>(pathSection(deps.location.pathname))
  const routeAppId = appIdFromPath(deps.location.pathname)

  const selectedApp = computed(() => apps.value.find(app => app.app_id === selectedAppId.value))
  const hasApps = computed(() => apps.value.length > 0)
  const showOnboarding = computed(() => !loading.value && !hasApps.value)
  const isAppScoped = computed(() => section.value !== 'home' && section.value !== 'api-keys' && section.value !== 'settings')
  const pageTitle = computed(() => consoleSectionTitle(section.value, showOnboarding.value))
  const pageEyebrow = computed(() => isAppScoped.value ? selectedApp.value?.name || 'App' : 'CodePushGo')
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

  function navigate(target: ConsoleSection, appId = selectedAppId.value, goTo: (href: string) => void = href => deps.history.pushState({}, '', href)) {
    section.value = target
    if (appId)
      selectedAppId.value = appId
    const href = target === 'home' ? '/app/home' : target === 'api-keys' ? '/dashboard/apikeys' : target === 'settings' ? '/settings/organization/plans' : appHref(appId, target)
    goTo(href)
    sidebarOpen.value = false
    appMenuOpen.value = false
  }

  async function requireSession() {
    if (!client) {
      error.value = 'Supabase public config is missing for console.codepushgo.com.'
      loading.value = false
      return false
    }

    const session = await getCurrentSession(client)
    if (!session) {
      deps.redirect('/login')
      return false
    }

    user.value = await getCurrentUser(client)
    return true
  }

  async function refreshAppData() {
    if (!client || !selectedAppId.value) {
      releases.value = []
      channels.value = []
      devices.value = []
      deviceChannels.value = []
      appStats.value = []
      return
    }

    releases.value = await listAppReleases(client, selectedAppId.value)
    channels.value = await safeSelect<ChannelRow>(client, 'channels', table => table
      .select('app_id,name,public,allow_self_set,ios,android,electron,created_at,updated_at')
      .eq('app_id', selectedAppId.value)
      .order('updated_at', { ascending: false }) as never)
    devices.value = await safeSelect<DeviceRow>(client, 'devices', table => table
      .select('app_id,device_id,platform,plugin_version,version_name,custom_id,default_channel,updated_at')
      .eq('app_id', selectedAppId.value)
      .order('updated_at', { ascending: false })
      .limit(50) as never)
    deviceChannels.value = await safeSelect<DeviceChannelRow>(client, 'device_channels', table => table
      .select('app_id,device_id,channel,created_at,updated_at')
      .eq('app_id', selectedAppId.value)
      .order('updated_at', { ascending: false }) as never)
    appStats.value = await safeSelect<AppStatRow>(client, 'stats_events', table => table
      .select('app_id,version_name,platform,action,device_id,created_at')
      .eq('app_id', selectedAppId.value)
      .order('created_at', { ascending: false })
      .limit(100) as never)
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

  async function copyCommand(command: string) {
    if (!command)
      return
    await deps.navigator.clipboard.writeText(command)
    copiedCommand.value = command
    deps.setTimeout(() => {
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
          path: deps.location.pathname,
          query: deps.location.search,
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
    deps.redirect('/login')
  }

  async function mount() {
    if (await requireSession())
      await refresh()
  }

  function syncPath(pathname = deps.location.pathname) {
    section.value = pathSection(pathname)
    const pathAppId = appIdFromPath(pathname)
    if (pathAppId)
      selectedAppId.value = pathAppId
  }

  watch(selectedAppId, () => {
    void refreshAppData()
  })

  return {
    appMenuOpen,
    appStats,
    apps,
    channels,
    copiedCommand,
    copyCommand,
    devices,
    deviceChannels,
    displayName,
    error,
    firstName,
    hasApps,
    initCommand,
    installCommand,
    latestRelease,
    loading,
    lastName,
    monthlyDevices,
    navigate,
    notice,
    onboardingCommands,
    pageEyebrow,
    pageTitle,
    pending,
    planRecorded,
    refresh,
    refreshAppData,
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
    syncPath,
    uploadCommand,
    user,
    mount,
  }
}

let consoleStore: ReturnType<typeof createConsoleStore> | undefined

export function useConsoleStore() {
  consoleStore ??= createConsoleStore()
  return consoleStore
}
