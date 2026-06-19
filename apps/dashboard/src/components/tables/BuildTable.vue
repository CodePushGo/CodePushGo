<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, GitBranch, Search } from 'lucide-vue-next'

const props = defineProps<{
  appId: string
  command: string
}>()

const emit = defineEmits<{
  copyCommand: [command: string]
}>()

const search = ref('')

const skeletonRows = computed(() => [
  { id: 'ios', platform: 'iOS', mode: 'Release', status: 'Removed', wait: '-', updated: '-' },
  { id: 'android', platform: 'Android', mode: 'Release', status: 'Removed', wait: '-', updated: '-' },
].filter(row => !search.value.trim() || [row.platform, row.mode, row.status].some(value => value.toLowerCase().includes(search.value.trim().toLowerCase()))))
</script>

<template>
  <div class="console-table-surface">
    <div class="table-toolbar">
      <div>
        <p class="eyebrow">Builds</p>
        <h2>Native builds</h2>
      </div>
      <div class="table-actions">
        <label class="search-field">
          <Search :size="16" />
          <input v-model="search" name="build-search" type="search" placeholder="Search builds" aria-label="Search builds">
        </label>
        <button type="button" disabled>
          <GitBranch :size="16" /> Start build
        </button>
      </div>
    </div>

    <div class="removed-feature-note">
      <strong>Cloud build is not enabled in CodePushGo.</strong>
      <span>Upload React Native bundles from CI or a local machine with the CLI. Native build rows are shown only for route compatibility.</span>
      <button type="button" @click="emit('copyCommand', props.command)">
        <Copy :size="16" /> Copy upload command
      </button>
    </div>

    <div class="table-scroll">
      <table aria-label="Builds table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Build mode</th>
            <th>Runner wait</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in skeletonRows" :key="`${props.appId}-${row.id}`" class="disabled-row">
            <td>-</td>
            <td>{{ row.platform }} {{ row.mode }}</td>
            <td>{{ row.wait }}</td>
            <td><span class="status-pill muted">{{ row.status }}</span></td>
            <td>{{ row.updated }}</td>
          </tr>
          <tr v-if="skeletonRows.length === 0">
            <td colspan="5" class="empty">No build placeholder matches this search.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
