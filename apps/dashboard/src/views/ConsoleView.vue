<script setup lang="ts">
import type { AppRecord, Platform, ReleaseRecord } from '@codepushgo/shared'
import { computed, onMounted, ref, watch } from 'vue'
import { CheckCircle2, Link2, RefreshCw, UploadCloud } from 'lucide-vue-next'

interface AppsResponse {
  apps: AppRecord[]
}

interface ReleasesResponse {
  releases: ReleaseRecord[]
}

const params = new URLSearchParams(window.location.search)
const apiUrl = ref(import.meta.env.VITE_API_URL || 'http://localhost:8787')
const apiKey = ref(import.meta.env.VITE_API_KEY || '')
const bundleId = ref(params.get('bundleId') || params.get('bundle_id') || params.get('app_id') || localStorage.getItem('codepushgo:bundleId') || '')
const apps = ref<AppRecord[]>([])
const releases = ref<ReleaseRecord[]>([])
const selectedAppId = ref(bundleId.value)
const pending = ref(false)
const notice = ref('')

const appName = ref('')
const releaseVersion = ref('')
const releasePlatform = ref<Platform>('ios')
const releaseChannel = ref('production')
const releaseRollout = ref(100)
const releaseMandatory = ref(false)
const releaseNotes = ref('')
const releaseFile = ref<File | undefined>()

const selectedApp = computed(() => apps.value.find((app) => app.appId === selectedAppId.value))
const activeBundleId = computed(() => bundleId.value.trim() || selectedAppId.value)

watch(bundleId, (value) => {
  localStorage.setItem('codepushgo:bundleId', value.trim())
})

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiKey.value)
    throw new Error('API token is required')

  const base = apiUrl.value.replace(/\/+$/, '')
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${apiKey.value}`)

  const response = await fetch(`${base}${path}`, { ...init, headers })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : response.statusText
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return body as T
}

async function run(label: string, action: () => Promise<void>) {
  pending.value = true
  notice.value = ''
  try {
    await action()
    notice.value = label
  }
  catch (error) {
    notice.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    pending.value = false
  }
}

function selectDefaultApp() {
  const preferred = bundleId.value.trim() || selectedAppId.value
  const appId = apps.value.some((app) => app.appId === preferred)
    ? preferred
    : apps.value[0]?.appId || preferred || ''
  selectedAppId.value = appId
  if (!bundleId.value && appId)
    bundleId.value = appId
}

async function loadApps() {
  const body = await request<AppsResponse>('/v1/apps')
  apps.value = body.apps
  selectDefaultApp()
}

async function connectBundleId() {
  await run('Native bundle id synced', async () => {
    const appId = activeBundleId.value.trim()
    if (!appId)
      throw new Error('Native bundle id is required')

    await request('/v1/apps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appId, app_id: appId, bundle_id: appId, name: appName.value.trim() || appId, owner_org: 'default-org' }),
    })
    bundleId.value = appId
    selectedAppId.value = appId
    await loadApps()
    selectedAppId.value = appId
    await loadReleases()
  })
}

async function refreshApps() {
  await run('Apps refreshed', async () => {
    await loadApps()
    if (selectedAppId.value)
      await loadReleases()
  })
}

async function loadReleases() {
  if (!selectedAppId.value) {
    releases.value = []
    return
  }

  const body = await request<ReleasesResponse>(`/v1/apps/${encodeURIComponent(selectedAppId.value)}/bundles`)
  releases.value = body.releases
}

async function refreshReleases() {
  await run('Releases refreshed', loadReleases)
}

function selectApp(appId: string) {
  selectedAppId.value = appId
  bundleId.value = appId
  void refreshReleases()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  releaseFile.value = input.files?.[0]
}

async function uploadRelease() {
  await run('Release uploaded', async () => {
    const appId = activeBundleId.value.trim()
    if (!appId)
      throw new Error('Native bundle id is required')
    if (!releaseVersion.value.trim())
      throw new Error('Version is required')
    if (!releaseFile.value)
      throw new Error('Bundle zip is required')

    if (selectedAppId.value !== appId)
      await connectBundleId()

    await request(`/v1/apps/${encodeURIComponent(appId)}/bundles`, {
      method: 'POST',
      headers: {
        'content-type': 'application/zip',
        'x-codepushgo-version': releaseVersion.value.trim(),
        'x-codepushgo-platform': releasePlatform.value,
        'x-codepushgo-channel': releaseChannel.value.trim() || 'production',
        'x-codepushgo-mandatory': String(releaseMandatory.value),
        'x-codepushgo-rollout': String(releaseRollout.value),
        ...(releaseNotes.value.trim() ? { 'x-codepushgo-notes': releaseNotes.value.trim() } : {}),
      },
      body: releaseFile.value,
    })

    releaseVersion.value = ''
    releaseNotes.value = ''
    releaseFile.value = undefined
    selectedAppId.value = appId
    await loadReleases()
  })
}

watch(apiKey, (value) => {
  if (!value.trim())
    return
  if (bundleId.value.trim())
    void connectBundleId()
  else
    void refreshApps()
})

onMounted(() => {
  if (!apiKey.value)
    return

  if (bundleId.value)
    void connectBundleId()
  else
    void refreshApps()
})
</script>

<template>
  <main class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="mark">CG</span>
        <div>
          <h1>CodePushGo</h1>
          <p>React Native updates</p>
        </div>
      </div>

      <form class="panel" @submit.prevent="connectBundleId">
        <label>
          Worker URL
          <input v-model="apiUrl" autocomplete="off">
        </label>
        <label>
          API token
          <input v-model="apiKey" type="password" autocomplete="current-password">
        </label>
        <label>
          Native bundle ID
          <input v-model="bundleId" placeholder="com.example.app" autocomplete="off">
        </label>
        <button class="primary" type="submit" :disabled="pending">
          <Link2 :size="16" />
          Sync
        </button>
      </form>

      <section class="panel">
        <div class="section-head compact">
          <h2>Apps</h2>
          <button :disabled="pending" title="Refresh apps" @click="refreshApps">
            <RefreshCw :size="16" />
          </button>
        </div>
        <div class="stack">
          <button
            v-for="app in apps"
            :key="app.appId"
            class="app-row"
            :class="{ active: app.appId === selectedAppId }"
            @click="selectApp(app.appId)"
          >
            <span>{{ app.name }}</span>
            <small>{{ app.appId }}</small>
          </button>
        </div>
      </section>
    </aside>

    <section class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ activeBundleId || 'Native bundle id missing' }}</p>
          <h2>{{ selectedApp?.name || 'React Native app' }}</h2>
        </div>
        <p v-if="notice" class="notice">
          <CheckCircle2 :size="16" />
          {{ notice }}
        </p>
      </header>

      <section class="grid two">
        <form class="panel" @submit.prevent="connectBundleId">
          <h3>Native identity</h3>
          <label>
            Native bundle ID
            <input v-model="bundleId" placeholder="com.example.app" autocomplete="off">
          </label>
          <label>
            Name
            <input v-model="appName" placeholder="Example App" autocomplete="off">
          </label>
          <button class="primary" :disabled="pending">
            <Link2 :size="16" />
            Sync bundle id
          </button>
        </form>

        <form class="panel" @submit.prevent="uploadRelease">
          <h3>Upload release</h3>
          <div class="form-grid">
            <label>
              Version
              <input v-model="releaseVersion" placeholder="1.0.1" autocomplete="off">
            </label>
            <label>
              Platform
              <select v-model="releasePlatform">
                <option value="ios">iOS</option>
                <option value="android">Android</option>
              </select>
            </label>
            <label>
              Channel
              <input v-model="releaseChannel" autocomplete="off">
            </label>
            <label>
              Rollout
              <input v-model.number="releaseRollout" type="number" min="1" max="100">
            </label>
          </div>
          <label>
            Notes
            <input v-model="releaseNotes" autocomplete="off">
          </label>
          <label class="file-input">
            Bundle zip
            <input type="file" accept=".zip,application/zip" @change="onFileChange">
          </label>
          <label class="check">
            <input v-model="releaseMandatory" type="checkbox">
            Mandatory
          </label>
          <button class="primary" :disabled="pending || !activeBundleId">
            <UploadCloud :size="16" />
            Upload
          </button>
        </form>
      </section>

      <section class="panel releases">
        <div class="section-head">
          <h3>Releases</h3>
          <button :disabled="pending || !selectedAppId" @click="refreshReleases">
            <RefreshCw :size="16" />
            Reload
          </button>
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
              <tr v-for="release in releases" :key="`${release.appId}-${release.platform}-${release.channel}-${release.version}`">
                <td>{{ release.version }}</td>
                <td>{{ release.platform }}</td>
                <td>{{ release.channel }}</td>
                <td>{{ release.rollout }}%</td>
                <td>{{ Math.round(release.size / 1024) }} KB</td>
                <td>{{ new Date(release.createdAt).toLocaleString() }}</td>
              </tr>
              <tr v-if="releases.length === 0">
                <td colspan="6" class="empty">No releases for this native bundle id.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  </main>
</template>
