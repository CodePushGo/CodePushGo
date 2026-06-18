<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ConsoleReleaseRecord } from '../../services/registration'

const props = defineProps<{
  appId: string
  releases: ConsoleReleaseRecord[]
}>()

function bundleKey(release: ConsoleReleaseRecord) {
  return `${release.platform}:${release.channel}:${release.version}`
}

function bundleHref(release: ConsoleReleaseRecord) {
  return props.appId ? `/app/${encodeURIComponent(props.appId)}/bundle/${encodeURIComponent(bundleKey(release))}` : '#'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
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
        </tr>
      </thead>
      <tbody>
        <tr v-for="release in releases" :key="`${release.app_id}-${release.platform}-${release.channel}-${release.version}`">
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
        </tr>
        <tr v-if="releases.length === 0">
          <td colspan="6" class="empty">No releases yet for this native bundle ID.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
