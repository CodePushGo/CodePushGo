<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import Usage from '../../components/dashboard/Usage.vue'
import { useConsoleStore } from '../../stores/console'

const {
  latestRelease,
  monthlyDevices,
  navigate,
  releases,
  releasesByPlatform,
} = useConsoleStore()

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}
</script>

<template>
  <Usage
    :devices="monthlyDevices"
    :bundles="releases.length"
    :ios-bundles="releasesByPlatform.ios || 0"
    :android-bundles="releasesByPlatform.android || 0"
    :latest-version="latestRelease?.version"
    :latest-channel="latestRelease?.channel"
  />

  <section class="dashboard-home-grid dashboard-content compact-content">
    <article class="console-table-card">
      <header>
        <h2>Latest bundles</h2>
        <button type="button" @click="navigate('releases')">View all</button>
      </header>
      <div class="release-feed">
        <div v-for="release in releases.slice(0, 5)" :key="`${release.app_id}-${release.platform}-${release.channel}-${release.version}`" class="release-feed-row">
          <span class="status-dot" />
          <div>
            <strong>{{ release.version }}</strong>
            <small>{{ release.platform }} / {{ release.channel }} / rollout {{ release.rollout ?? 100 }}%</small>
          </div>
          <span>{{ formatDate(release.created_at) }}</span>
        </div>
        <p v-if="releases.length === 0" class="empty-state">No JavaScript bundle uploaded yet.</p>
      </div>
    </article>

    <article class="quickstart-card">
      <p class="eyebrow">Install snippet</p>
      <h2>Start updates from JavaScript</h2>
      <pre><code>import { startCodePushGo } from '@codepushgo/react-native-updater'

startCodePushGo()</code></pre>
      <p>The updater auto-connects with the native bundle ID exposed by React Native.</p>
    </article>
  </section>
</template>
