<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Smartphone } from 'lucide-vue-next'
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
const deviceStats = computed(() => appStats.value.filter(stat => stat.device_id === device.value?.device_id).slice(0, 10))
const currentRelease = computed(() => releases.value.find(release => release.version === device.value?.version_name))
const backHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/devices`)
const channelHref = computed(() => effectiveChannel.value ? `/app/${encodeURIComponent(selectedAppId.value)}/channel/${encodeURIComponent(effectiveChannel.value)}` : '')

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
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

    <div v-if="device" class="dashboard-home-grid compact-content">
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

    <div v-else class="empty-state">
      Device not found for this native bundle ID.
    </div>
  </section>

  <section v-if="device" class="dashboard-home-grid dashboard-content compact-content">
    <article class="console-table-card">
      <header>
        <h2>Recent update stats</h2>
      </header>
      <div class="release-feed">
        <div v-for="stat in deviceStats" :key="`${stat.action}-${stat.created_at}`" class="release-feed-row">
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
