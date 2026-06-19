<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ExternalLink, Search, Settings } from 'lucide-vue-next'
import type { ConsoleAppRecord } from '../../services/registration'

const props = defineProps<{
  apps: ConsoleAppRecord[]
  selectedAppId: string
}>()

const search = ref('')

const filteredApps = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query)
    return props.apps
  return props.apps.filter(app => [app.name, app.app_id, app.owner_org].some(value => value?.toLowerCase().includes(query)))
})

function appInitials(name: string) {
  return name.slice(0, 2).toUpperCase() || 'AP'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <div class="console-table-surface">
    <div class="table-toolbar">
      <div>
        <p class="eyebrow">Apps</p>
        <h2>All apps</h2>
      </div>
      <div class="table-actions">
        <label class="search-field">
          <Search :size="16" />
          <input v-model="search" name="app-search" type="search" placeholder="Search by name or app id" aria-label="Search apps">
        </label>
        <RouterLink class="button primary" to="/app/new">New app</RouterLink>
      </div>
    </div>

    <div class="table-scroll">
      <table aria-label="Apps table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Native bundle ID</th>
            <th>Created</th>
            <th>Onboarding</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="app in filteredApps" :key="app.app_id" :class="{ active: app.app_id === selectedAppId }">
            <th scope="row">
              <RouterLink class="app-name-cell" :to="`/app/${encodeURIComponent(app.app_id)}`">
                <span class="app-icon">{{ appInitials(app.name) }}</span>
                <span>
                  <strong>{{ app.name }}</strong>
                  <small>{{ app.owner_org || 'Current organization' }}</small>
                </span>
              </RouterLink>
            </th>
            <td><code>{{ app.app_id }}</code></td>
            <td>{{ formatDate(app.created_at) }}</td>
            <td>
              <span class="status-pill" :class="app.need_onboarding ? 'warning' : 'success'">
                {{ app.need_onboarding ? 'Needs setup' : 'Ready' }}
              </span>
            </td>
            <td>
              <div class="row-actions">
                <RouterLink :to="`/app/${encodeURIComponent(app.app_id)}/info`" aria-label="App settings">
                  <Settings :size="16" />
                </RouterLink>
                <RouterLink :to="`/app/${encodeURIComponent(app.app_id)}`" aria-label="Open app">
                  <ExternalLink :size="16" />
                </RouterLink>
              </div>
            </td>
          </tr>
          <tr v-if="filteredApps.length === 0">
            <td colspan="5" class="empty">No React Native apps match this search.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
