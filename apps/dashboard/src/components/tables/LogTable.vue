<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import type { AppStatRow } from '../../stores/console'

defineOptions({ name: 'LogTable' })

const props = defineProps<{
  appStats: AppStatRow[]
}>()

const search = ref('')
const action = ref('all')

const actions = computed(() => [...new Set(props.appStats.map(stat => stat.action).filter((value): value is string => Boolean(value)))])
const filteredStats = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.appStats.filter((stat) => {
    const matchesSearch = !query || [stat.action, stat.version_name, stat.platform, stat.device_id].some(value => value?.toLowerCase().includes(query))
    const matchesAction = action.value === 'all' || stat.action === action.value
    return matchesSearch && matchesAction
  })
})

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <div class="console-table-surface">
    <div class="table-toolbar">
      <div>
        <p class="eyebrow">Logs</p>
        <h2>{{ filteredStats.length }} shown</h2>
      </div>
      <div class="table-actions">
        <label class="search-field">
          <Search :size="16" />
          <input v-model="search" name="log-search" type="search" placeholder="Search logs" aria-label="Search logs">
        </label>
        <select v-model="action" name="log-action" aria-label="Filter logs by action">
          <option value="all">All actions</option>
          <option v-for="name in actions" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
    </div>

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
          <tr v-for="stat in filteredStats" :key="`${stat.action}-${stat.device_id}-${stat.created_at}`">
            <td>{{ stat.action || '-' }}</td>
            <td>{{ stat.version_name || '-' }}</td>
            <td>{{ stat.platform || '-' }}</td>
            <td>{{ stat.device_id || '-' }}</td>
            <td>{{ formatDate(stat.created_at) }}</td>
          </tr>
          <tr v-if="filteredStats.length === 0">
            <td colspan="5" class="empty">No update stats match these filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
