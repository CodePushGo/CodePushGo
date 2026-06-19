<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Copy, ExternalLink, Search } from 'lucide-vue-next'
import type { ConsoleReleaseRecord } from '../../services/registration'

const props = defineProps<{
  appId: string
  releases: ConsoleReleaseRecord[]
}>()

const emit = defineEmits<{
  copyBundle: [release: ConsoleReleaseRecord]
}>()

const search = ref('')
const platform = ref('all')
const channel = ref('all')

const channels = computed(() => [...new Set(props.releases.map(release => release.channel).filter(Boolean))])
const filteredReleases = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.releases.filter((release) => {
    const matchesSearch = !query || [release.version, release.platform, release.channel, release.notes, release.checksum].some(value => value?.toLowerCase().includes(query))
    const matchesPlatform = platform.value === 'all' || release.platform === platform.value
    const matchesChannel = channel.value === 'all' || release.channel === channel.value
    return matchesSearch && matchesPlatform && matchesChannel
  })
})

function bundleKey(release: ConsoleReleaseRecord) {
  const resourceId = (release as ConsoleReleaseRecord & { id?: number | string }).id
  return resourceId ? String(resourceId) : `${release.platform}:${release.channel}:${release.version}`
}

function bundleHref(release: ConsoleReleaseRecord) {
  return props.appId ? `/app/${encodeURIComponent(props.appId)}/bundle/${encodeURIComponent(bundleKey(release))}` : '#'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <div class="console-table-surface">
    <div class="table-toolbar">
      <div>
        <p class="eyebrow">Bundles</p>
        <h2>{{ filteredReleases.length }} shown</h2>
      </div>
      <div class="table-actions">
        <label class="search-field">
          <Search :size="16" />
          <input v-model="search" name="bundle-search" type="search" placeholder="Search bundles" aria-label="Search bundles">
        </label>
        <select v-model="platform" name="bundle-platform" aria-label="Filter bundles by platform">
          <option value="all">All platforms</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
        </select>
        <select v-model="channel" name="bundle-channel" aria-label="Filter bundles by channel">
          <option value="all">All channels</option>
          <option v-for="name in channels" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
    </div>

    <div class="table-scroll">
      <table aria-label="Release table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Platform</th>
            <th>Channel</th>
            <th>Rollout</th>
            <th>Size</th>
            <th>Created</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="release in filteredReleases" :key="`${release.app_id}-${release.platform}-${release.channel}-${release.version}`">
            <th scope="row">
              <RouterLink :to="bundleHref(release)">
                {{ release.version }}
              </RouterLink>
            </th>
            <td>{{ release.platform }}</td>
            <td>{{ release.channel }}</td>
            <td>{{ release.rollout ?? 100 }}%</td>
            <td>{{ release.size ? `${Math.round(release.size / 1024)} KB` : '-' }}</td>
            <td>{{ formatDate(release.created_at) }}</td>
            <td>
              <div class="row-actions">
                <button type="button" aria-label="Copy bundle version" @click="emit('copyBundle', release)"><Copy :size="16" /></button>
                <RouterLink :to="bundleHref(release)" aria-label="Open bundle"><ExternalLink :size="16" /></RouterLink>
              </div>
            </td>
          </tr>
          <tr v-if="filteredReleases.length === 0">
            <td colspan="7" class="empty">No releases match these filters for this native bundle ID.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
