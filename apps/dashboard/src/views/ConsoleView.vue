<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight, CheckCircle2, Copy, Loader2, LogOut, RefreshCw, Rocket, Settings, Smartphone, UploadCloud } from 'lucide-vue-next'
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
const selectedPlan = ref(normalizePlan(new URLSearchParams(window.location.search).get('plan')))
const selectedBilling = ref(normalizeBillingPeriod(new URLSearchParams(window.location.search).get('billing') || new URLSearchParams(window.location.search).get('interval')))
const planRecorded = ref(false)

const selectedApp = computed(() => apps.value.find(app => app.app_id === selectedAppId.value))
const hasApps = computed(() => apps.value.length > 0)
const displayName = computed(() => {
  const metadata = user.value?.user_metadata || {}
  const name = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ')
  return name || user.value?.email || 'Developer'
})
const firstName = computed(() => String(user.value?.user_metadata?.first_name || ''))
const lastName = computed(() => String(user.value?.user_metadata?.last_name || ''))

const onboardingCommands = computed(() => [
  {
    title: 'Log in to the CLI',
    command: 'npx @codepushgo/cli@latest login',
    subtitle: 'Use the API key from this console when key creation is enabled.',
  },
  {
    title: 'Add your React Native app',
    command: 'npx @codepushgo/cli@latest init',
    subtitle: 'The CLI should detect the native bundle ID from ios and android projects.',
  },
  {
    title: 'Install the updater client',
    command: 'npm install @codepushgo/react-native-updater',
    subtitle: 'Native build support is intentionally out of scope for this first console.',
  },
  {
    title: 'Bundle and upload',
    command: 'npx @codepushgo/cli@latest bundle --platform ios && npx @codepushgo/cli@latest upload',
    subtitle: 'Upload JavaScript bundles through the Cloudflare Worker backend.',
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

async function copyCommand(command: string) {
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
  <main class="console-shell">
    <aside class="console-sidebar">
      <div class="brand">
        <span class="mark">CG</span>
        <div>
          <h1>CodePushGo</h1>
          <p>React Native updates</p>
        </div>
      </div>

      <nav class="console-nav" aria-label="Console navigation">
        <a class="active" href="/app/home">
          <Smartphone :size="16" />
          Apps
        </a>
        <a href="/dashboard/settings/plans">
          <Settings :size="16" />
          Plans
        </a>
      </nav>

      <section class="panel user-panel">
        <p class="eyebrow">Signed in</p>
        <strong>{{ displayName }}</strong>
        <small>{{ user?.email }}</small>
        <button type="button" @click="signOut">
          <LogOut :size="16" />
          Sign out
        </button>
      </section>
    </aside>

    <section class="console-content">
      <header class="topbar">
        <div>
          <p class="eyebrow">Console</p>
          <h2>Apps</h2>
        </div>
        <button type="button" :disabled="pending || loading" @click="refresh">
          <RefreshCw :size="16" />
          Refresh
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

      <template v-else>
        <section v-if="!hasApps" class="onboarding-view">
          <div class="onboarding-head">
            <p class="eyebrow">Start using CodePushGo</p>
            <h2>Add your first React Native app</h2>
            <p>Copy the commands in order. The app should connect through the native bundle ID by default, matching the Capgo console flow adapted for React Native.</p>
          </div>

          <div class="onboarding-grid">
            <article class="panel plan-panel">
              <p class="eyebrow">Plan intent</p>
              <h3>Choose after registration</h3>
              <div class="segmented" aria-label="Billing period">
                <button :class="{ active: selectedBilling === 'monthly' }" type="button" @click="selectedBilling = 'monthly'">Monthly</button>
                <button :class="{ active: selectedBilling === 'yearly' }" type="button" @click="selectedBilling = 'yearly'">Yearly</button>
              </div>
              <div class="plan-picker compact-plan-picker" aria-label="Plan intent">
                <button type="button" :class="{ active: selectedPlan === 'trial' }" @click="selectedPlan = 'trial'">
                  <span>Trial</span>
                  <small>Start with one app</small>
                </button>
                <button type="button" :class="{ active: selectedPlan === 'solo' }" @click="selectedPlan = 'solo'">
                  <span>Solo</span>
                  <small>For a production app</small>
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

            <div class="steps-list">
              <article v-for="(step, index) in onboardingCommands" :key="step.title" class="step-card">
                <span class="step-index">{{ index + 1 }}</span>
                <div>
                  <h3>{{ step.title }}</h3>
                  <button class="command" type="button" @click="copyCommand(step.command)">
                    <code>{{ step.command }}</code>
                    <Copy :size="16" />
                  </button>
                  <p>{{ copiedCommand === step.command ? 'Copied' : step.subtitle }}</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <template v-else>
          <section class="apps-layout">
            <aside class="panel apps-panel">
              <div class="section-head compact">
                <h3>Your apps</h3>
                <span>{{ apps.length }}</span>
              </div>
              <div class="stack">
                <button
                  v-for="app in apps"
                  :key="app.app_id"
                  class="app-row"
                  :class="{ active: app.app_id === selectedAppId }"
                  type="button"
                  @click="selectedAppId = app.app_id"
                >
                  <span>{{ app.name }}</span>
                  <small>{{ app.app_id }}</small>
                </button>
              </div>
            </aside>

            <section class="panel releases">
              <div class="section-head">
                <div>
                  <p class="eyebrow">{{ selectedApp?.app_id }}</p>
                  <h3>{{ selectedApp?.name || 'React Native app' }}</h3>
                </div>
                <button type="button" :disabled="pending || !selectedAppId" @click="refreshReleases">
                  <RefreshCw :size="16" />
                  Reload
                </button>
              </div>

              <div class="metrics-strip">
                <div>
                  <strong>{{ releases.length }}</strong>
                  <span>recent releases</span>
                </div>
                <div>
                  <strong>{{ releases[0]?.channel || 'production' }}</strong>
                  <span>latest channel</span>
                </div>
                <div>
                  <strong>{{ releases[0]?.version || '-' }}</strong>
                  <span>latest version</span>
                </div>
              </div>

              <div class="table-scroll">
                <table>
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
          </section>

          <section class="panel upload-note">
            <Rocket :size="20" />
            <div>
              <h3>Upload from the CLI</h3>
              <p>Bundle uploads stay in the CLI/Worker path. The console reads the resulting apps and releases from Supabase like Capgo, adapted for React Native.</p>
            </div>
            <button type="button" @click="copyCommand('npx @codepushgo/cli@latest upload')">
              <UploadCloud :size="16" />
              Copy upload command
            </button>
          </section>
        </template>
      </template>
    </section>
  </main>
</template>
