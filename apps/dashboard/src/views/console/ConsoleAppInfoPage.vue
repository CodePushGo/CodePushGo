<script setup lang="ts">
import { Info, PackageOpen } from 'lucide-vue-next'
import { useConsoleStore } from '../../stores/console'

const {
  channels,
  devices,
  latestRelease,
  releases,
  releasesByPlatform,
  selectedApp,
  selectedAppId,
} = useConsoleStore()

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">App information</p>
        <h2>{{ selectedApp?.name || selectedAppId }}</h2>
      </div>
      <Info :size="18" />
    </header>

    <div v-if="selectedApp" class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Native identity</p>
        <h2>{{ selectedApp.app_id }}</h2>
        <dl class="detail-list">
          <div>
            <dt>Name</dt>
            <dd>{{ selectedApp.name }}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{{ selectedApp.owner_org || '-' }}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{{ formatDate(selectedApp.created_at) }}</dd>
          </div>
          <div>
            <dt>Needs onboarding</dt>
            <dd>{{ selectedApp.need_onboarding ? 'Yes' : 'No' }}</dd>
          </div>
        </dl>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">Runtime surface</p>
        <h2>{{ releases.length }} bundles</h2>
        <dl class="detail-list">
          <div>
            <dt>Channels</dt>
            <dd>{{ channels.length }}</dd>
          </div>
          <div>
            <dt>Devices</dt>
            <dd>{{ devices.length }}</dd>
          </div>
          <div>
            <dt>iOS bundles</dt>
            <dd>{{ releasesByPlatform.ios || 0 }}</dd>
          </div>
          <div>
            <dt>Android bundles</dt>
            <dd>{{ releasesByPlatform.android || 0 }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-else class="empty-state">
      App not found for this native bundle ID.
    </div>
  </section>

  <section v-if="selectedApp" class="dashboard-content console-table-card">
    <header>
      <h2>Latest bundle</h2>
      <PackageOpen :size="18" />
    </header>
    <div class="release-feed">
      <div v-if="latestRelease" class="release-feed-row">
        <span class="status-dot" />
        <div>
          <strong>{{ latestRelease.version }}</strong>
          <small>{{ latestRelease.platform }} / {{ latestRelease.channel }} / rollout {{ latestRelease.rollout ?? 100 }}%</small>
        </div>
        <span>{{ formatDate(latestRelease.created_at) }}</span>
      </div>
      <p v-else class="empty-state">No JavaScript bundle uploaded yet.</p>
    </div>
  </section>
</template>
