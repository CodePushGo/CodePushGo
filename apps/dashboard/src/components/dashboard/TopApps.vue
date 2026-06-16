<script setup lang="ts">
import type { ConsoleAppRecord } from '../../services/registration'

defineProps<{
  apps: ConsoleAppRecord[]
  selectedAppId: string
}>()

const emit = defineEmits<{
  openApp: [appId: string]
}>()

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <article class="console-table-card top-apps-card">
    <header>
      <h2>Apps</h2>
      <span>{{ apps.length }}</span>
    </header>
    <div class="table-scroll">
      <table aria-label="Apps table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Bundle ID</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="app in apps"
            :key="app.app_id"
            class="app-table-row"
            :class="{ active: app.app_id === selectedAppId }"
            @click="emit('openApp', app.app_id)"
          >
            <td>
              <div class="app-name-cell">
                <span class="app-icon">{{ app.name.slice(0, 2).toUpperCase() }}</span>
                <strong>{{ app.name }}</strong>
              </div>
            </td>
            <td>{{ app.app_id }}</td>
            <td>{{ formatDate(app.created_at) }}</td>
          </tr>
          <tr v-if="apps.length === 0">
            <td colspan="3" class="empty">No React Native apps connected yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
