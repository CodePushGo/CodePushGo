<script setup lang="ts">
import type { ConsoleTab } from '../constants/consoleTabs'

defineProps<{
  tabs: ConsoleTab[]
  activeTab: string
  secondaryTabs?: ConsoleTab[]
  secondaryActiveTab?: string
}>()
</script>

<template>
  <nav class="console-tabs" aria-label="Section tabs">
    <div class="console-tabs-row primary-tabs">
      <RouterLink v-for="tab in tabs" :key="tab.key" :to="tab.key" :class="{ active: activeTab === tab.key }">
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
      </RouterLink>
    </div>
    <div v-if="secondaryTabs?.length" class="console-tabs-row secondary-tabs">
      <RouterLink v-for="tab in secondaryTabs" :key="tab.key" :to="tab.key" :class="{ active: secondaryActiveTab === tab.key }">
        <component :is="tab.icon" :size="15" />
        <span>{{ tab.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
