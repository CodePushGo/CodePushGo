<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { RadioTower } from 'lucide-vue-next'
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
const channel = computed(() => channels.value.find(row => row.name === decodedChannelName.value))
const channelReleases = computed(() => releases.value.filter(release => release.channel === decodedChannelName.value))
const overrideDeviceIds = computed(() => new Set(deviceChannels.value.filter(row => row.channel === decodedChannelName.value).map(row => row.device_id)))
const overriddenDeviceIds = computed(() => new Set(deviceChannels.value.map(row => row.device_id)))
const channelDevices = computed(() => devices.value.filter((device) => {
  const deviceId = device.device_id || ''
  return overrideDeviceIds.value.has(deviceId) || (device.default_channel === decodedChannelName.value && !overriddenDeviceIds.value.has(deviceId))
}))
const channelDeviceIds = computed(() => new Set(channelDevices.value.map(device => device.device_id).filter(Boolean)))
const channelStats = computed(() => appStats.value.filter(stat => stat.device_id && channelDeviceIds.value.has(stat.device_id)).slice(0, 5))
const backHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/channels`)

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

    <div v-if="channel" class="dashboard-home-grid compact-content">
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

    <div v-else class="empty-state">
      Channel not found for this native bundle ID.
    </div>
  </section>

  <section v-if="channel" class="dashboard-home-grid dashboard-content compact-content">
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
