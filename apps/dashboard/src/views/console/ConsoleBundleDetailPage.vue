<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Code2, GitCompareArrows, History, PackageOpen, ShieldCheck } from 'lucide-vue-next'
import ConsoleTabs from '../../components/ConsoleTabs.vue'
import type { ConsoleTab } from '../../constants/consoleTabs'
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
const bundleStats = computed(() => appStats.value.filter(stat => stat.version_name === bundle.value?.version || (stat.device_id && bundleDeviceIds.value.has(stat.device_id))).slice(0, 25))
const backHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/bundles`)
const bundleBaseHref = computed(() => `/app/${encodeURIComponent(selectedAppId.value)}/bundle/${encodeURIComponent(decodedBundleKey.value)}`)
const activeBundleTab = computed(() => {
  const path = route.path.replace(/\/$/, '')
  if (path.endsWith('/history'))
    return `${bundleBaseHref.value}/history`
  if (path.endsWith('/manifest'))
    return `${bundleBaseHref.value}/manifest`
  if (path.endsWith('/dependencies'))
    return `${bundleBaseHref.value}/dependencies`
  if (path.endsWith('/preview'))
    return `${bundleBaseHref.value}/preview`
  return bundleBaseHref.value
})
const bundleTabs = computed<ConsoleTab[]>(() => [
  { label: 'Overview', key: bundleBaseHref.value, icon: PackageOpen },
  { label: 'History', key: `${bundleBaseHref.value}/history`, icon: History },
  { label: 'Manifest', key: `${bundleBaseHref.value}/manifest`, icon: Code2 },
  { label: 'Dependencies', key: `${bundleBaseHref.value}/dependencies`, icon: GitCompareArrows },
  { label: 'Preview', key: `${bundleBaseHref.value}/preview`, icon: ShieldCheck },
])
const manifestEntries = computed(() => normalizeEntries(bundle.value?.manifest))
const nativePackages = computed(() => normalizeEntries(bundle.value?.native_packages))

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatSize(value?: number | null) {
  return value ? `${Math.round(value / 1024)} KB` : '-'
}

function countArray(value?: unknown[] | null) {
  return Array.isArray(value) ? value.length : 0
}

function normalizeEntries(value?: unknown[] | null) {
  return Array.isArray(value) ? value.map((entry, index) => ({ index, entry })) : []
}

function entryField(entry: unknown, keys: string[]) {
  if (!entry || typeof entry !== 'object')
    return '-'
  const record = entry as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '')
      return String(value)
  }
  return '-'
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

    <ConsoleTabs v-if="bundle" :tabs="bundleTabs" :active-tab="activeBundleTab" />

    <div v-if="bundle && activeBundleTab === bundleBaseHref" class="dashboard-home-grid compact-content">
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

    <div v-else-if="bundle && activeBundleTab.endsWith('/history')" class="release-feed">
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

    <div v-else-if="bundle && activeBundleTab.endsWith('/manifest')" class="table-scroll">
      <table aria-label="Manifest table">
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Checksum</th>
            <th scope="col">Size</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in manifestEntries" :key="item.index">
            <th scope="row">{{ entryField(item.entry, ['file_name', 'name', 'path']) }}</th>
            <td>{{ entryField(item.entry, ['file_hash', 'hash', 'checksum']) }}</td>
            <td>{{ entryField(item.entry, ['file_size', 'size']) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="manifestEntries.length === 0" class="empty-state">No manifest entries have been recorded for this bundle yet.</p>
    </div>

    <div v-else-if="bundle && activeBundleTab.endsWith('/dependencies')" class="table-scroll">
      <table aria-label="Native packages table">
        <thead>
          <tr>
            <th scope="col">Package</th>
            <th scope="col">Version</th>
            <th scope="col">Checksum</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in nativePackages" :key="item.index">
            <th scope="row">{{ entryField(item.entry, ['name', 'package', 'id']) }}</th>
            <td>{{ entryField(item.entry, ['version']) }}</td>
            <td>{{ entryField(item.entry, ['checksum', 'hash']) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="nativePackages.length === 0" class="empty-state">No native packages have been recorded for this bundle yet.</p>
    </div>

    <div v-else-if="bundle && activeBundleTab.endsWith('/preview')" class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Preview</p>
        <h2>{{ bundle.version }}</h2>
        <pre><code>{{ JSON.stringify({ app_id: bundle.app_id, platform: bundle.platform, channel: bundle.channel, version: bundle.version, checksum: bundle.checksum, mandatory: bundle.mandatory, rollout: bundle.rollout ?? 100 }, null, 2) }}</code></pre>
      </article>
      <article class="quickstart-card">
        <p class="eyebrow">Storage</p>
        <h2>{{ bundle.path || 'No bundle path' }}</h2>
        <p>{{ bundle.notes || 'No release notes have been recorded for this bundle yet.' }}</p>
      </article>
    </div>

    <div v-else class="empty-state">
      Bundle not found for this native bundle ID.
    </div>
  </section>

  <section v-if="bundle && activeBundleTab === bundleBaseHref" class="dashboard-home-grid dashboard-content compact-content">
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
        <div v-for="stat in bundleStats.slice(0, 10)" :key="`${stat.action}-${stat.device_id}-${stat.created_at}`" class="release-feed-row">
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
