<script setup lang="ts">
import type { ConsoleReleaseRecord } from '../../services/registration'

defineProps<{
  releases: ConsoleReleaseRecord[]
}>()

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
          <td>{{ release.version }}</td>
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
