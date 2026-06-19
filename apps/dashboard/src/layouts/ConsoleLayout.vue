<script setup lang="ts">
import type { ConsoleSection } from '../services/consoleRoute'
import type { ConsoleAppRecord } from '../services/registration'
import Navbar from '../components/Navbar.vue'
import Sidebar from '../components/Sidebar.vue'

defineProps<{
  apps: ConsoleAppRecord[]
  currentSection: ConsoleSection
  selectedAppId: string
  sidebarOpen: boolean
  displayName: string
  email?: string
  title: string
  eyebrow: string
}>()

const emit = defineEmits<{
  closeSidebar: []
  toggleSidebar: []
  navigate: [section: ConsoleSection, appId?: string]
  signOut: []
}>()
</script>

<template>
  <main class="capgo-console-shell">
    <Sidebar
      :apps="apps"
      :current-section="currentSection"
      :selected-app-id="selectedAppId"
      :sidebar-open="sidebarOpen"
      :display-name="displayName"
      :email="email"
      @close-sidebar="emit('closeSidebar')"
      @navigate="(section, appId) => emit('navigate', section, appId)"
      @sign-out="emit('signOut')"
    />

    <section class="capgo-console-content">
      <Navbar
        :sidebar-open="sidebarOpen"
        :title="title"
        :eyebrow="eyebrow"
        @toggle-sidebar="emit('toggleSidebar')"
      />

      <slot />
    </section>
  </main>
</template>
