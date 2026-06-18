<script setup lang="ts">
import { RadioTower } from 'lucide-vue-next'
import { useConsoleStore } from '../../stores/console'

const { channels } = useConsoleStore()

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <h2>Channels</h2>
      <RadioTower :size="18" />
    </header>
    <div class="table-scroll">
      <table aria-label="Channels table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Platforms</th>
            <th>Public</th>
            <th>Self set</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="channel in channels" :key="`${channel.app_id}-${channel.name}`">
            <td>{{ channel.name }}</td>
            <td>{{ [channel.ios ? 'iOS' : '', channel.android ? 'Android' : '', channel.electron ? 'Electron' : ''].filter(Boolean).join(' / ') || '-' }}</td>
            <td>{{ channel.public ? 'Yes' : 'No' }}</td>
            <td>{{ channel.allow_self_set ? 'Yes' : 'No' }}</td>
            <td>{{ formatDate(channel.updated_at || channel.created_at) }}</td>
          </tr>
          <tr v-if="channels.length === 0">
            <td colspan="5" class="empty">No channel rows yet. Upload and release a bundle to create production.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
