<script setup lang="ts">
defineProps<{
  devices: number
  bundles: number
  iosBundles: number
  androidBundles: number
  latestVersion?: string
  latestChannel?: string
}>()
</script>

<template>
  <div class="dashboard-grid">
    <article class="metric-card usage-card">
      <div>
        <p>Devices</p>
        <strong>{{ devices }}</strong>
        <span>recent active devices</span>
      </div>
    </article>
    <article class="metric-card">
      <div>
        <p>Bundles</p>
        <strong>{{ bundles }}</strong>
        <span>{{ iosBundles }} iOS / {{ androidBundles }} Android</span>
      </div>
    </article>
    <article class="metric-card">
      <div>
        <p>Latest</p>
        <strong>{{ latestVersion || '-' }}</strong>
        <span>{{ latestChannel || 'no release yet' }}</span>
      </div>
    </article>
  </div>
</template>
