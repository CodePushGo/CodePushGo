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
  appMenuOpen: boolean
  displayName: string
  email?: string
  pending: boolean
  loading: boolean
  title: string
  eyebrow: string
}>()

const emit = defineEmits<{
  closeSidebar: []
  toggleSidebar: []
  toggleAppMenu: []
  navigate: [section: ConsoleSection, appId?: string]
  signOut: []
  refresh: []
  upload: []
}>()
</script>

<template>
  <main class="capgo-console-shell">
    <Sidebar
      :apps="apps"
      :current-section="currentSection"
      :selected-app-id="selectedAppId"
      :sidebar-open="sidebarOpen"
      :app-menu-open="appMenuOpen"
      :display-name="displayName"
      :email="email"
      @close-sidebar="emit('closeSidebar')"
      @toggle-app-menu="emit('toggleAppMenu')"
      @navigate="(section, appId) => emit('navigate', section, appId)"
      @sign-out="emit('signOut')"
    />

    <section class="capgo-console-content">
      <Navbar
        :sidebar-open="sidebarOpen"
        :pending="pending"
        :loading="loading"
        :title="title"
        :eyebrow="eyebrow"
        @toggle-sidebar="emit('toggleSidebar')"
        @refresh="emit('refresh')"
        @upload="emit('upload')"
      />

      <slot />
    </section>
  </main>
</template>
