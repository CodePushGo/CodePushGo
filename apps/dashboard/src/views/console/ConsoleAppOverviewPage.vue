<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Copy, RadioTower, Smartphone } from 'lucide-vue-next'
import CompatibilityBanner from '../../components/dashboard/CompatibilityBanner.vue'
import Usage from '../../components/dashboard/Usage.vue'
import { useConsoleStore } from '../../stores/console'

const {
  channels,
  copyCommand,
  devices,
  latestRelease,
  monthlyDevices,
  navigate,
  releaseCommand,
  releases,
  selectedAppId,
  uploadCommand,
  releasesByPlatform,
} = useConsoleStore()

const productionChannel = computed(() => channels.value.find(channel => channel.name === 'production') || channels.value[0])
const recentDevices = computed(() => devices.value.slice(0, 5))

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <CompatibilityBanner :app-id="selectedAppId" />

  <Usage
    :devices="monthlyDevices"
    :bundles="releases.length"
    :ios-bundles="releasesByPlatform.ios || 0"
    :android-bundles="releasesByPlatform.android || 0"
    :latest-version="latestRelease?.version"
    :latest-channel="latestRelease?.channel"
  />

  <section class="dashboard-content overview-hero-grid">
    <article class="quickstart-card">
      <p class="eyebrow">Release workflow</p>
      <h2>Ship JavaScript bundles from your React Native project</h2>
      <div class="command-list">
        <button class="command" type="button" @click="copyCommand(uploadCommand)">
          <code>{{ uploadCommand }}</code>
          <Copy :size="16" />
        </button>
        <button class="command" type="button" @click="copyCommand(releaseCommand)">
          <code>{{ releaseCommand }}</code>
          <Copy :size="16" />
        </button>
      </div>
      <p>Use the native bundle ID already detected by the CLI. Channels and devices below reflect the same app identity.</p>
    </article>

    <article class="quickstart-card">
      <p class="eyebrow">Current app</p>
      <h2>{{ selectedAppId || 'No app selected' }}</h2>
      <dl class="detail-list">
        <div>
          <dt>Production channel</dt>
          <dd>
            <RouterLink v-if="productionChannel" :to="`/app/${encodeURIComponent(selectedAppId)}/channel/${encodeURIComponent(productionChannel.name)}`">{{ productionChannel.name }}</RouterLink>
            <span v-else>-</span>
          </dd>
        </div>
        <div>
          <dt>Latest bundle</dt>
          <dd>{{ latestRelease?.version || '-' }}</dd>
        </div>
        <div>
          <dt>Devices</dt>
          <dd>{{ monthlyDevices }}</dd>
        </div>
      </dl>
    </article>
  </section>

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

    <article class="console-table-card">
      <header>
        <h2>Channels</h2>
        <button type="button" @click="navigate('channels')"><RadioTower :size="16" /> View all</button>
      </header>
      <div class="release-feed">
        <div v-for="channel in channels.slice(0, 5)" :key="`${channel.app_id}-${channel.name}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ channel.name }}</strong>
            <small>{{ [channel.ios ? 'iOS' : '', channel.android ? 'Android' : ''].filter(Boolean).join(' / ') || 'all platforms' }}</small>
          </div>
          <span>{{ formatDate(channel.updated_at || channel.created_at) }}</span>
        </div>
        <p v-if="channels.length === 0" class="empty-state">No channel rows yet.</p>
      </div>
    </article>

    <article class="console-table-card">
      <header>
        <h2>Recent devices</h2>
        <button type="button" @click="navigate('devices')"><Smartphone :size="16" /> View all</button>
      </header>
      <div class="release-feed">
        <div v-for="device in recentDevices" :key="device.device_id || `${device.platform}-${device.updated_at}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ device.device_id || device.custom_id || '-' }}</strong>
            <small>{{ device.platform || '-' }} / {{ device.version_name || '-' }}</small>
          </div>
          <span>{{ formatDate(device.updated_at) }}</span>
        </div>
        <p v-if="recentDevices.length === 0" class="empty-state">No devices have checked for updates yet.</p>
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
