<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import ConsoleTabs from '../components/ConsoleTabs.vue'
import { accountTabs, organizationTabs, settingsTabs } from '../constants/consoleTabs'

const route = useRoute()

const activePrimary = computed(() => route.path.startsWith('/settings/account') ? '/settings/account' : '/settings/organization')
const secondaryTabs = computed(() => activePrimary.value === '/settings/account' ? accountTabs : organizationTabs)
const activeSecondary = computed(() => {
  const path = route.path.replace(/\/$/, '')
  const ordered = [...secondaryTabs.value].sort((a, b) => b.key.length - a.key.length)
  return ordered.find(tab => path === tab.key || path.startsWith(`${tab.key}/`))?.key ?? secondaryTabs.value[0]?.key ?? activePrimary.value
})
</script>

<template>
  <section class="console-route-layout">
    <ConsoleTabs
      :tabs="settingsTabs"
      :active-tab="activePrimary"
      :secondary-tabs="secondaryTabs"
      :secondary-active-tab="activeSecondary"
    />
    <RouterView />
  </section>
</template>
