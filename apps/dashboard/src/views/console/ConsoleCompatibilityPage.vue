<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-vue-next'
import { dependencyDiffPath, groupCompatibilityEvents, listCompatibilityEvents, platformLabel, reasonLabel, type CompatibilityEventGroup, type CompatibilityEventRow } from '../../services/compatibilityEvents'
import { createDashboardClient } from '../../services/registration'
import { useConsoleStore } from '../../stores/console'

const client = createDashboardClient()
const { selectedAppId } = useConsoleStore()
const events = ref<CompatibilityEventRow[]>([])
const loading = ref(false)
const error = ref('')
const showUnresolvedOnly = ref(true)

const groups = computed(() => groupCompatibilityEvents(events.value))
const visibleGroups = computed<CompatibilityEventGroup[]>(() => showUnresolvedOnly.value ? groups.value.filter(group => !group.resolved) : groups.value)
const unresolvedCount = computed(() => groups.value.filter(group => !group.resolved).length)

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function eventTitle(group: CompatibilityEventGroup) {
  const event = group.representative
  const channel = event.channel_name || 'channel'
  const current = event.current_version_name || 'current bundle'
  return `${channel} now points to ${current}`
}

function dependencyHref(event: CompatibilityEventRow) {
  return dependencyDiffPath(selectedAppId.value, event)
}

async function refreshCompatibilityEvents() {
  error.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }
  if (!selectedAppId.value)
    return

  loading.value = true
  try {
    events.value = await listCompatibilityEvents(client, selectedAppId.value)
  }
  catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : String(loadError)
    events.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(refreshCompatibilityEvents)
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">Compatibility</p>
        <h2>Native compatibility events</h2>
      </div>
      <button type="button" @click="refreshCompatibilityEvents">
        <RefreshCw :size="16" />
        Refresh
      </button>
    </header>

    <div class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Unresolved</p>
        <h2>{{ unresolvedCount }}</h2>
        <p>Events where a JavaScript bundle may require a native release before rollout continues.</p>
      </article>
      <article class="quickstart-card">
        <p class="eyebrow">History</p>
        <h2>{{ groups.length }}</h2>
        <p>Grouped by channel change, bundle pair, and timestamp so platform rows stay together.</p>
      </article>
    </div>

    <label class="filter-row">
      <input v-model="showUnresolvedOnly" type="checkbox">
      Show unresolved only
    </label>

    <p v-if="error" class="form-alert error">{{ error }}</p>
    <p v-else-if="loading" class="empty-state">Loading compatibility events...</p>

    <div v-else class="table-scroll">
      <table aria-label="Compatibility events table">
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Platforms</th>
            <th scope="col">Previous bundle</th>
            <th scope="col">Status</th>
            <th scope="col">Changed</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in visibleGroups" :key="group.key">
            <th scope="row">
              <div class="stacked-cell">
                <strong>{{ eventTitle(group) }}</strong>
                <small>{{ group.representative.source.replaceAll('_', ' ') }}</small>
                <RouterLink v-if="dependencyHref(group.representative)" :to="dependencyHref(group.representative)!">View dependency diff</RouterLink>
              </div>
            </th>
            <td>{{ group.platforms.map(platformLabel).join(' / ') }}</td>
            <td>{{ group.representative.previous_version_name || '-' }}</td>
            <td>
              <span v-if="group.resolved" class="status-pill success"><CheckCircle2 :size="14" /> Resolved</span>
              <span v-else class="status-pill warning"><AlertTriangle :size="14" /> Unresolved</span>
              <small v-if="group.resolved">{{ reasonLabel(group.representative) }}</small>
            </td>
            <td>{{ formatDate(group.representative.change_occurred_at || group.representative.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="visibleGroups.length === 0" class="empty-state">No compatibility event matches this filter.</p>
    </div>
  </section>
</template>
