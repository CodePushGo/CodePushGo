<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { History, Rocket, Smartphone } from 'lucide-vue-next'
import ConsoleTabs from '../../components/ConsoleTabs.vue'
import type { ConsoleTab } from '../../constants/consoleTabs'
import { useConsoleStore } from '../../stores/console'

const route = useRoute()
const {
  appStats,
  deviceChannels,
  devices,
  releases,
  selectedAppId,
} = useConsoleStore()

const routeDeviceId = computed(() => String(route.params.device || ''))
const decodedDeviceId = computed(() => decodeURIComponent(routeDeviceId.value))
const device = computed(() => devices.value.find(row => row.device_id === decodedDeviceId.value || row.custom_id === decodedDeviceId.value))
const deviceOverride = computed(() => deviceChannels.value.find(row => row.device_id === device.value?.device_id))
const effectiveChannel = computed(() => deviceOverride.value?.channel || device.value?.default_channel || '')
const deviceStats = computed(() => appStats.value.filter(stat => stat.device_id === device.value?.device_id).slice(0, 25))
const currentRelease = computed(() => releases.value.find(release => release.version === device.value?.version_name))
const deploymentReleases = computed(() => releases.value.filter(release => release.version === device.value?.version_name || release.channel === effectiveChannel.value))
const backHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/devices`)
const channelHref = computed(() => effectiveChannel.value ? `/app/${encodeURIComponent(selectedAppId.value)}/channel/${encodeURIComponent(effectiveChannel.value)}` : '')
const deviceBaseHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/device/${encodeURIComponent(decodedDeviceId.value)}`)
const activeDeviceTab = computed(() => {
  const path = route.path.replace(/\/$/, '')
  if (path.endsWith('/logs'))
    return `${deviceBaseHref.value}/logs`
  if (path.endsWith('/deployments'))
    return `${deviceBaseHref.value}/deployments`
  return deviceBaseHref.value
})
const deviceTabs = computed<ConsoleTab[]>(() => [
  { label: 'Overview', key: deviceBaseHref.value, icon: Smartphone },
  { label: 'Deployments', key: `${deviceBaseHref.value}/deployments`, icon: Rocket },
  { label: 'Logs', key: `${deviceBaseHref.value}/logs`, icon: History },
])

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function releaseKey(release: { platform: string, channel: string, version: string }) {
  return `${release.platform}:${release.channel}:${release.version}`
}
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <RouterLink class="eyebrow" :to="backHref">Devices</RouterLink>
        <h2>{{ decodedDeviceId }}</h2>
      </div>
      <Smartphone :size="18" />
    </header>

    <ConsoleTabs v-if="device" :tabs="deviceTabs" :active-tab="activeDeviceTab" />

    <div v-if="device && activeDeviceTab === deviceBaseHref" class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Device identity</p>
        <h2>{{ device.custom_id || device.device_id }}</h2>
        <dl class="detail-list">
          <div>
            <dt>Device ID</dt>
            <dd>{{ device.device_id || '-' }}</dd>
          </div>
          <div v-if="device.custom_id">
            <dt>Custom ID</dt>
            <dd>{{ device.custom_id }}</dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{{ device.platform || '-' }}</dd>
          </div>
          <div>
            <dt>Plugin</dt>
            <dd>{{ device.plugin_version || '-' }}</dd>
          </div>
        </dl>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">Update state</p>
        <h2>{{ device.version_name || 'No bundle' }}</h2>
        <dl class="detail-list">
          <div>
            <dt>Effective channel</dt>
            <dd>
              <RouterLink v-if="channelHref" :to="channelHref">{{ effectiveChannel }}</RouterLink>
              <span v-else>-</span>
            </dd>
          </div>
          <div>
            <dt>Device override</dt>
            <dd>{{ deviceOverride?.channel || '-' }}</dd>
          </div>
          <div>
            <dt>Default channel</dt>
            <dd>{{ device.default_channel || '-' }}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{{ formatDate(device.updated_at) }}</dd>
          </div>
          <div>
            <dt>Known bundle</dt>
            <dd>{{ currentRelease ? 'Yes' : 'No' }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-else-if="device && activeDeviceTab.endsWith('/deployments')" class="table-scroll">
      <table aria-label="Device deployments table">
        <thead>
          <tr>
            <th scope="col">Bundle</th>
            <th scope="col">Platform</th>
            <th scope="col">Channel</th>
            <th scope="col">Rollout</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="release in deploymentReleases" :key="`${release.app_id}-${release.platform}-${release.channel}-${release.version}`">
            <th scope="row">
              <RouterLink :to="`/app/${encodeURIComponent(selectedAppId)}/bundle/${encodeURIComponent(releaseKey(release))}`">{{ release.version }}</RouterLink>
            </th>
            <td>{{ release.platform }}</td>
            <td>{{ release.channel }}</td>
            <td>{{ release.rollout ?? 100 }}%</td>
            <td>{{ formatDate(release.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="deploymentReleases.length === 0" class="empty-state">No deployment is linked to this device yet.</p>
    </div>

    <div v-else-if="device && activeDeviceTab.endsWith('/logs')" class="table-scroll">
      <table aria-label="Device logs table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Platform</th>
            <th scope="col">Bundle</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in deviceStats" :key="`${stat.action}-${stat.created_at}`">
            <th scope="row">{{ stat.action || '-' }}</th>
            <td>{{ stat.platform || device.platform || '-' }}</td>
            <td>{{ stat.version_name || device.version_name || '-' }}</td>
            <td>{{ formatDate(stat.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="deviceStats.length === 0" class="empty-state">No update stats have been recorded for this device yet.</p>
    </div>

    <div v-else class="empty-state">
      Device not found for this native bundle ID.
    </div>
  </section>

  <section v-if="device && activeDeviceTab === deviceBaseHref" class="dashboard-home-grid dashboard-content compact-content">
    <article class="console-table-card">
      <header>
        <h2>Recent update stats</h2>
      </header>
      <div class="release-feed">
        <div v-for="stat in deviceStats.slice(0, 10)" :key="`${stat.action}-${stat.created_at}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ stat.action || '-' }}</strong>
            <small>{{ stat.platform || device.platform || '-' }} / {{ stat.version_name || device.version_name || '-' }}</small>
          </div>
          <span>{{ formatDate(stat.created_at) }}</span>
        </div>
        <p v-if="deviceStats.length === 0" class="empty-state">No update stats have been recorded for this device yet.</p>
      </div>
    </article>

    <article class="quickstart-card">
      <p class="eyebrow">Device update request</p>
      <h2>React Native bundle ID</h2>
      <pre><code>{{ JSON.stringify({ app_id: selectedAppId, device_id: device.device_id, channel: effectiveChannel, device_channel: deviceOverride?.channel || null, default_channel: device.default_channel, version_name: device.version_name, platform: device.platform }, null, 2) }}</code></pre>
      <p>Device checks use the same app identity and bundle version recorded by the updater.</p>
    </article>
  </section>
</template>
