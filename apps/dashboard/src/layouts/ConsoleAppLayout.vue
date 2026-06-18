<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import ConsoleTabs from '../components/ConsoleTabs.vue'
import { appTabs } from '../constants/consoleTabs'

const route = useRoute()

const appRouteSegment = computed(() => {
  const match = route.path.match(/^\/app\/([^/]+)/)
  return match?.[1] ?? ''
})

const tabs = computed(() => appTabs.map(tab => ({
  ...tab,
  key: tab.key ? `/app/${appRouteSegment.value}${tab.key}` : `/app/${appRouteSegment.value}`,
})))

const activeTab = computed(() => {
  const path = route.path.replace(/\/$/, '')
  const ordered = [...tabs.value].sort((a, b) => b.key.length - a.key.length)
  return ordered.find(tab => path === tab.key || path.startsWith(`${tab.key}/`))?.key ?? `/app/${appRouteSegment.value}`
})
</script>

<template>
  <section class="console-route-layout">
    <ConsoleTabs :tabs="tabs" :active-tab="activeTab" />
    <RouterView />
  </section>
</template>
