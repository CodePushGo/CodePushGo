<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { DeviceRow } from '../../stores/console'

const props = defineProps<{
  appId: string
  devices: DeviceRow[]
}>()

function deviceHref(device: DeviceRow) {
  const deviceId = device.device_id || device.custom_id
  return props.appId && deviceId ? `/app/${encodeURIComponent(props.appId)}/device/${encodeURIComponent(deviceId)}` : '#'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
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
        </tr>
      </thead>
      <tbody>
        <tr v-for="device in devices" :key="device.device_id || `${device.platform}-${device.updated_at}`">
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
        </tr>
        <tr v-if="devices.length === 0">
          <td colspan="6" class="empty">No devices have checked for updates yet.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
