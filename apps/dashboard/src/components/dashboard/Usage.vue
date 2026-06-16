<script setup lang="ts">
import { Layers3, Rocket, Smartphone } from 'lucide-vue-next'

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
      <Smartphone :size="24" />
    </article>
    <article class="metric-card">
      <div>
        <p>Bundles</p>
        <strong>{{ bundles }}</strong>
        <span>{{ iosBundles }} iOS / {{ androidBundles }} Android</span>
      </div>
      <Layers3 :size="24" />
    </article>
    <article class="metric-card">
      <div>
        <p>Latest</p>
        <strong>{{ latestVersion || '-' }}</strong>
        <span>{{ latestChannel || 'no release yet' }}</span>
      </div>
      <Rocket :size="24" />
    </article>
  </div>
</template>
