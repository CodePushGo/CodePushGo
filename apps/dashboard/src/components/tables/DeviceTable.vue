<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ExternalLink, Search } from 'lucide-vue-next'
import type { DeviceRow } from '../../stores/console'

const props = defineProps<{
  appId: string
  devices: DeviceRow[]
}>()

const search = ref('')
const platform = ref('all')

const filteredDevices = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.devices.filter((device) => {
    const matchesSearch = !query || [device.device_id, device.custom_id, device.version_name, device.default_channel, device.plugin_version].some(value => value?.toLowerCase().includes(query))
    const matchesPlatform = platform.value === 'all' || device.platform === platform.value
    return matchesSearch && matchesPlatform
  })
})

function deviceKey(device: DeviceRow) {
  const resourceId = (device as DeviceRow & { id?: number | string }).id
  return resourceId ? String(resourceId) : device.device_id || device.custom_id || ''
}

function deviceHref(device: DeviceRow) {
  const key = deviceKey(device)
  return props.appId && key ? `/app/${encodeURIComponent(props.appId)}/device/${encodeURIComponent(key)}` : '#'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <div class="console-table-surface">
    <div class="table-toolbar">
      <div>
        <p class="eyebrow">Devices</p>
        <h2>{{ filteredDevices.length }} shown</h2>
      </div>
      <div class="table-actions">
        <label class="search-field">
          <Search :size="16" />
          <input v-model="search" name="device-search" type="search" placeholder="Search devices" aria-label="Search devices">
        </label>
        <select v-model="platform" name="device-platform" aria-label="Filter devices by platform">
          <option value="all">All platforms</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
        </select>
      </div>
    </div>

    <div class="table-scroll">
      <table aria-label="Devices table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Platform</th>
            <th>Default channel</th>
            <th>Bundle</th>
            <th>Plugin</th>
            <th>Last seen</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="device in filteredDevices" :key="device.device_id || `${device.platform}-${device.updated_at}`">
            <th scope="row">
              <RouterLink :to="deviceHref(device)">
                {{ device.device_id || device.custom_id || '-' }}
              </RouterLink>
            </th>
            <td>{{ device.platform || '-' }}</td>
            <td>{{ device.default_channel || '-' }}</td>
            <td>{{ device.version_name || '-' }}</td>
            <td>{{ device.plugin_version || '-' }}</td>
            <td>{{ formatDate(device.updated_at) }}</td>
            <td>
              <div class="row-actions">
                <RouterLink :to="deviceHref(device)" aria-label="Open device"><ExternalLink :size="16" /></RouterLink>
              </div>
            </td>
          </tr>
          <tr v-if="filteredDevices.length === 0">
            <td colspan="7" class="empty">No devices match these filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
