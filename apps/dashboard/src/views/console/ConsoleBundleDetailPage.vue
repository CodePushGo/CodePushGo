<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { PackageOpen } from 'lucide-vue-next'
import { useConsoleStore } from '../../stores/console'

const route = useRoute()
const {
  appStats,
  channels,
  devices,
  releases,
  selectedAppId,
} = useConsoleStore()

const routeBundle = computed(() => String(route.params.bundle || ''))
const decodedBundleKey = computed(() => decodeURIComponent(routeBundle.value))
const bundleKeyParts = computed(() => decodedBundleKey.value.split(':'))
const bundlePlatform = computed(() => bundleKeyParts.value[0] || '')
const bundleChannel = computed(() => bundleKeyParts.value[1] || '')
const decodedBundle = computed(() => bundleKeyParts.value.slice(2).join(':') || decodedBundleKey.value)
const bundle = computed(() => releases.value.find(release => release.platform === bundlePlatform.value && release.channel === bundleChannel.value && release.version === decodedBundle.value) || releases.value.find(release => release.version === decodedBundle.value))
const bundleReleases = computed(() => releases.value.filter(release => release.version === bundle.value?.version && release.platform === bundle.value?.platform && release.channel === bundle.value?.channel))
const bundleChannels = computed(() => channels.value.filter(channel => channel.name === bundle.value?.channel))
const bundleDevices = computed(() => devices.value.filter(device => device.version_name === bundle.value?.version))
const bundleDeviceIds = computed(() => new Set(bundleDevices.value.map(device => device.device_id).filter(Boolean)))
const bundleStats = computed(() => appStats.value.filter(stat => stat.version_name === bundle.value?.version || (stat.device_id && bundleDeviceIds.value.has(stat.device_id))).slice(0, 10))
const backHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/bundles`)

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatSize(value?: number | null) {
  return value ? `${Math.round(value / 1024)} KB` : '-'
}
function countArray(value?: unknown[] | null) {
  return Array.isArray(value) ? value.length : 0
}
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <RouterLink class="eyebrow" :to="backHref">Bundles</RouterLink>
        <h2>{{ decodedBundle }}</h2>
      </div>
      <PackageOpen :size="18" />
    </header>

    <div v-if="bundle" class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Bundle release</p>
        <h2>{{ bundle.version }}</h2>
        <dl class="detail-list">
          <div>
            <dt>Platform</dt>
            <dd>{{ bundle.platform }}</dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>
              <RouterLink :to="`/app/${encodeURIComponent(selectedAppId)}/channel/${encodeURIComponent(bundle.channel)}`">{{ bundle.channel }}</RouterLink>
            </dd>
          </div>
          <div>
            <dt>Rollout</dt>
            <dd>{{ bundle.rollout ?? 100 }}%</dd>
          </div>
          <div>
            <dt>Mandatory</dt>
            <dd>{{ bundle.mandatory ? 'Yes' : 'No' }}</dd>
          </div>
          <div>
            <dt>Checksum</dt>
            <dd>{{ bundle.checksum || '-' }}</dd>
          </div>
          <div>
            <dt>Encrypted</dt>
            <dd>{{ bundle.session_key ? 'Yes' : 'No' }}</dd>
          </div>
          <div>
            <dt>Key ID</dt>
            <dd>{{ bundle.key_id || '-' }}</dd>
          </div>
          <div>
            <dt>Min update version</dt>
            <dd>{{ bundle.min_update_version || '-' }}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{{ bundle.notes || '-' }}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{{ formatDate(bundle.created_at) }}</dd>
          </div>
        </dl>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">Distribution</p>
        <h2>{{ bundleDevices.length }} devices</h2>
        <dl class="detail-list">
          <div>
            <dt>Channels</dt>
            <dd>{{ bundleChannels.length }}</dd>
          </div>
          <div>
            <dt>Release rows</dt>
            <dd>{{ bundleReleases.length }}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{{ formatSize(bundle.size) }}</dd>
          </div>
          <div>
            <dt>Manifest entries</dt>
            <dd>{{ countArray(bundle.manifest) }}</dd>
          </div>
          <div>
            <dt>Native packages</dt>
            <dd>{{ countArray(bundle.native_packages) }}</dd>
          </div>
          <div>
            <dt>Storage path</dt>
            <dd>{{ bundle.path || '-' }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-else class="empty-state">
      Bundle not found for this native bundle ID.
    </div>
  </section>

  <section v-if="bundle" class="dashboard-home-grid dashboard-content compact-content">
    <article class="console-table-card">
      <header>
        <h2>Channels</h2>
      </header>
      <div class="release-feed">
        <div v-for="channel in bundleChannels" :key="`${channel.app_id}-${channel.name}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ channel.name }}</strong>
            <small>{{ channel.public ? 'public' : 'private' }} / self set {{ channel.allow_self_set ? 'yes' : 'no' }}</small>
          </div>
          <RouterLink :to="`/app/${encodeURIComponent(selectedAppId)}/channel/${encodeURIComponent(channel.name)}`">Open</RouterLink>
        </div>
        <p v-if="bundleChannels.length === 0" class="empty-state">No channel is linked to this bundle yet.</p>
      </div>
    </article>

    <article class="console-table-card">
      <header>
        <h2>Recent update stats</h2>
      </header>
      <div class="release-feed">
        <div v-for="stat in bundleStats" :key="`${stat.action}-${stat.device_id}-${stat.created_at}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ stat.action || '-' }}</strong>
            <small>{{ stat.platform || bundle.platform }} / {{ stat.device_id || '-' }}</small>
          </div>
          <span>{{ formatDate(stat.created_at) }}</span>
        </div>
        <p v-if="bundleStats.length === 0" class="empty-state">No update stats have been recorded for this bundle yet.</p>
      </div>
    </article>
  </section>
</template>
