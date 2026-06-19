<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ExternalLink, Search, SlidersHorizontal } from 'lucide-vue-next'
import type { ChannelRow } from '../../stores/console'

const props = defineProps<{
  appId: string
  channels: ChannelRow[]
}>()

const search = ref('')
const visibility = ref('all')

const filteredChannels = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.channels.filter((channel) => {
    const matchesSearch = !query || [channel.name, channel.app_id].some(value => value?.toLowerCase().includes(query))
    const matchesVisibility = visibility.value === 'all' || (visibility.value === 'public' ? channel.public : !channel.public)
    return matchesSearch && matchesVisibility
  })
})

function channelKey(channel: ChannelRow) {
  const resourceId = (channel as ChannelRow & { id?: number | string }).id
  return resourceId ? String(resourceId) : channel.name
}

function channelHref(channel: ChannelRow) {
  return props.appId ? `/app/${encodeURIComponent(props.appId)}/channel/${encodeURIComponent(channelKey(channel))}` : '#'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <div class="console-table-surface">
    <div class="table-toolbar">
      <div>
        <p class="eyebrow">Channels</p>
        <h2>{{ filteredChannels.length }} shown</h2>
      </div>
      <div class="table-actions">
        <label class="search-field">
          <Search :size="16" />
          <input v-model="search" name="channel-search" type="search" placeholder="Search channels" aria-label="Search channels">
        </label>
        <select v-model="visibility" name="channel-visibility" aria-label="Filter channels by visibility">
          <option value="all">All visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        <button type="button" disabled><SlidersHorizontal :size="16" /> New channel</button>
      </div>
    </div>

    <div class="table-scroll">
      <table aria-label="Channels table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Platforms</th>
            <th>Public</th>
            <th>Self set</th>
            <th>Updated</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="channel in filteredChannels" :key="`${channel.app_id}-${channel.name}`">
            <th scope="row">
              <RouterLink :to="channelHref(channel)">
                {{ channel.name }}
              </RouterLink>
            </th>
            <td>{{ [channel.ios ? 'iOS' : '', channel.android ? 'Android' : '', channel.electron ? 'Electron' : ''].filter(Boolean).join(' / ') || '-' }}</td>
            <td><span class="status-pill" :class="channel.public ? 'success' : 'muted'">{{ channel.public ? 'Yes' : 'No' }}</span></td>
            <td>{{ channel.allow_self_set ? 'Yes' : 'No' }}</td>
            <td>{{ formatDate(channel.updated_at || channel.created_at) }}</td>
            <td>
              <div class="row-actions">
                <RouterLink :to="channelHref(channel)" aria-label="Open channel"><ExternalLink :size="16" /></RouterLink>
              </div>
            </td>
          </tr>
          <tr v-if="filteredChannels.length === 0">
            <td colspan="6" class="empty">No channel rows match these filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
