<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Activity, Eye, History, RadioTower, Smartphone } from 'lucide-vue-next'
import ConsoleTabs from '../../components/ConsoleTabs.vue'
import type { ConsoleTab } from '../../constants/consoleTabs'
import { useConsoleStore } from '../../stores/console'

const route = useRoute()
const {
  appStats,
  channels,
  deviceChannels,
  devices,
  releases,
  selectedAppId,
} = useConsoleStore()

const channelName = computed(() => String(route.params.channel || ''))
const decodedChannelName = computed(() => decodeURIComponent(channelName.value))
const channel = computed(() => channels.value.find(row => String((row as typeof row & { id?: number | string }).id || '') === decodedChannelName.value) || channels.value.find(row => row.name === decodedChannelName.value))
const channelReleases = computed(() => releases.value.filter(release => release.channel === decodedChannelName.value))
const overrideDeviceIds = computed(() => new Set(deviceChannels.value.filter(row => row.channel === decodedChannelName.value).map(row => row.device_id)))
const overriddenDeviceIds = computed(() => new Set(deviceChannels.value.map(row => row.device_id)))
const channelDevices = computed(() => devices.value.filter((device) => {
  const deviceId = device.device_id || ''
  return overrideDeviceIds.value.has(deviceId) || (device.default_channel === decodedChannelName.value && !overriddenDeviceIds.value.has(deviceId))
}))
const channelDeviceIds = computed(() => new Set(channelDevices.value.map(device => device.device_id).filter(Boolean)))
const channelStats = computed(() => appStats.value.filter(stat => stat.device_id && channelDeviceIds.value.has(stat.device_id)).slice(0, 25))
const backHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/channels`)
const channelBaseHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/channel/${encodeURIComponent(decodedChannelName.value)}`)
const activeChannelTab = computed(() => {
  const path = route.path.replace(/\/$/, '')
  if (path.endsWith('/devices'))
    return `${channelBaseHref.value}/devices`
  if (path.endsWith('/history'))
    return `${channelBaseHref.value}/history`
  if (path.endsWith('/statistics'))
    return `${channelBaseHref.value}/statistics`
  if (path.endsWith('/preview'))
    return `${channelBaseHref.value}/preview`
  return channelBaseHref.value
})
const channelTabs = computed<ConsoleTab[]>(() => [
  { label: 'Overview', key: channelBaseHref.value, icon: RadioTower },
  { label: 'Devices', key: `${channelBaseHref.value}/devices`, icon: Smartphone },
  { label: 'History', key: `${channelBaseHref.value}/history`, icon: History },
  { label: 'Statistics', key: `${channelBaseHref.value}/statistics`, icon: Activity },
  { label: 'Preview', key: `${channelBaseHref.value}/preview`, icon: Eye },
])

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatBoolean(value?: boolean | null) {
  return value ? 'Yes' : 'No'
}

function formatPlatforms() {
  if (!channel.value)
    return '-'
  return [
    channel.value.ios ? 'iOS' : '',
    channel.value.android ? 'Android' : '',
    channel.value.electron ? 'Electron' : '',
  ].filter(Boolean).join(' / ') || '-'
}

function deviceChannelMode(deviceId?: string | null) {
  if (!deviceId)
    return 'default'
  return overrideDeviceIds.value.has(deviceId) ? 'override' : 'default'
}
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <RouterLink class="eyebrow" :to="backHref">Channels</RouterLink>
        <h2>{{ decodedChannelName }}</h2>
      </div>
      <RadioTower :size="18" />
    </header>

    <ConsoleTabs v-if="channel" :tabs="channelTabs" :active-tab="activeChannelTab" />

    <div v-if="channel && activeChannelTab === channelBaseHref" class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Channel settings</p>
        <h2>{{ channel.name }}</h2>
        <dl class="detail-list">
          <div>
            <dt>Platforms</dt>
            <dd>{{ formatPlatforms() }}</dd>
          </div>
          <div>
            <dt>Public</dt>
            <dd>{{ formatBoolean(channel.public) }}</dd>
          </div>
          <div>
            <dt>Self set</dt>
            <dd>{{ formatBoolean(channel.allow_self_set) }}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{{ formatDate(channel.updated_at || channel.created_at) }}</dd>
          </div>
        </dl>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">Usage</p>
        <h2>{{ channelDevices.length }} devices</h2>
        <dl class="detail-list">
          <div>
            <dt>Bundles</dt>
            <dd>{{ channelReleases.length }}</dd>
          </div>
          <div>
            <dt>Stats</dt>
            <dd>{{ channelStats.length }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-else-if="channel && activeChannelTab.endsWith('/devices')" class="table-scroll">
      <table aria-label="Channel devices table">
        <thead>
          <tr>
            <th scope="col">Device</th>
            <th scope="col">Platform</th>
            <th scope="col">Bundle</th>
            <th scope="col">Channel mode</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="device in channelDevices" :key="device.device_id || `${device.platform}-${device.updated_at}`">
            <th scope="row">
              <RouterLink :to="`/app/${encodeURIComponent(selectedAppId)}/device/${encodeURIComponent(device.device_id || '')}`">{{ device.device_id || device.custom_id || '-' }}</RouterLink>
            </th>
            <td>{{ device.platform || '-' }}</td>
            <td>{{ device.version_name || '-' }}</td>
            <td>{{ deviceChannelMode(device.device_id) }}</td>
            <td>{{ formatDate(device.updated_at) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="channelDevices.length === 0" class="empty-state">No device is using this channel yet.</p>
    </div>

    <div v-else-if="channel && activeChannelTab.endsWith('/history')" class="release-feed">
      <div v-for="release in channelReleases" :key="`${release.app_id}-${release.platform}-${release.version}`" class="release-feed-row">
        <span class="status-dot" />
        <div>
          <strong>{{ release.version }}</strong>
          <small>{{ release.platform }} / rollout {{ release.rollout ?? 100 }}%</small>
        </div>
        <span>{{ formatDate(release.created_at) }}</span>
      </div>
      <p v-if="channelReleases.length === 0" class="empty-state">No bundle is linked to this channel yet.</p>
    </div>

    <div v-else-if="channel && activeChannelTab.endsWith('/statistics')" class="table-scroll">
      <table aria-label="Channel statistics table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Device</th>
            <th scope="col">Platform</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in channelStats" :key="`${stat.action}-${stat.device_id}-${stat.created_at}`">
            <th scope="row">{{ stat.action || '-' }}</th>
            <td>{{ stat.device_id || '-' }}</td>
            <td>{{ stat.platform || '-' }}</td>
            <td>{{ formatDate(stat.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="channelStats.length === 0" class="empty-state">No update stats have been recorded for this channel yet.</p>
    </div>

    <div v-else-if="channel && activeChannelTab.endsWith('/preview')" class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Preview</p>
        <h2>{{ channel.name }}</h2>
        <pre><code>{{ JSON.stringify({ app_id: channel.app_id, name: channel.name, public: channel.public, allow_self_set: channel.allow_self_set, ios: channel.ios, android: channel.android }, null, 2) }}</code></pre>
      </article>
      <article class="quickstart-card">
        <p class="eyebrow">Assignment</p>
        <h2>{{ channelDevices.length }} devices</h2>
        <p>{{ overrideDeviceIds.size }} devices explicitly target this channel. The rest use it through their default channel.</p>
      </article>
    </div>

    <div v-else class="empty-state">
      Channel not found for this native bundle ID.
    </div>
  </section>

  <section v-if="channel && activeChannelTab === channelBaseHref" class="dashboard-home-grid dashboard-content compact-content">
    <article class="console-table-card">
      <header>
        <h2>Linked bundles</h2>
      </header>
      <div class="release-feed">
        <div v-for="release in channelReleases" :key="`${release.app_id}-${release.platform}-${release.version}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ release.version }}</strong>
            <small>{{ release.platform }} / rollout {{ release.rollout ?? 100 }}%</small>
          </div>
          <span>{{ formatDate(release.created_at) }}</span>
        </div>
        <p v-if="channelReleases.length === 0" class="empty-state">No bundle is linked to this channel yet.</p>
      </div>
    </article>

    <article class="console-table-card">
      <header>
        <h2>Devices</h2>
      </header>
      <div class="release-feed">
        <div v-for="device in channelDevices.slice(0, 10)" :key="device.device_id || `${device.platform}-${device.updated_at}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ device.device_id || device.custom_id || '-' }}</strong>
            <small>{{ device.platform || '-' }} / {{ device.version_name || '-' }}</small>
          </div>
          <span>{{ formatDate(device.updated_at) }}</span>
        </div>
        <p v-if="channelDevices.length === 0" class="empty-state">No device is using this channel yet.</p>
      </div>
    </article>
  </section>
</template>
