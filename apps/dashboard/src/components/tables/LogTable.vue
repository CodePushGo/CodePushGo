<script setup lang="ts">
import type { AppStatRow } from '../../stores/console'

defineProps<{
  appStats: AppStatRow[]
}>()

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <div class="table-scroll">
    <table aria-label="Stats table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Version</th>
          <th>Platform</th>
          <th>Device</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stat in appStats" :key="`${stat.action}-${stat.device_id}-${stat.created_at}`">
          <td>{{ stat.action || '-' }}</td>
          <td>{{ stat.version_name || '-' }}</td>
          <td>{{ stat.platform || '-' }}</td>
          <td>{{ stat.device_id || '-' }}</td>
          <td>{{ formatDate(stat.created_at) }}</td>
        </tr>
        <tr v-if="appStats.length === 0">
          <td colspan="5" class="empty">No update stats have been recorded yet.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
