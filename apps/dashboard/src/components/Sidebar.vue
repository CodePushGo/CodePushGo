<script setup lang="ts">
import {
  BookOpen,
  ChartNoAxesColumn,
  ChevronDown,
  Home,
  KeyRound,
  Layers3,
  LogOut,
  RadioTower,
  Settings,
  Smartphone,
  X,
} from 'lucide-vue-next'
import { computed } from 'vue'
import type { Component } from 'vue'
import type { ConsoleAppRecord } from '../services/registration'
import type { ConsoleSection } from '../services/consoleRoute'

const props = defineProps<{
  apps: ConsoleAppRecord[]
  currentSection: ConsoleSection
  selectedAppId: string
  sidebarOpen: boolean
  appMenuOpen: boolean
  displayName: string
  email?: string
}>()

const emit = defineEmits<{
  closeSidebar: []
  toggleAppMenu: []
  navigate: [section: ConsoleSection, appId?: string]
  signOut: []
}>()

interface NavItem {
  section: ConsoleSection
  label: string
  icon: Component
}

const selectedApp = computed(() => props.apps.find(app => app.app_id === props.selectedAppId))
const hasApps = computed(() => props.apps.length > 0)
const appNavItems = computed<NavItem[]>(() => props.selectedAppId
  ? [
      { section: 'overview', label: 'Overview', icon: ChartNoAxesColumn },
      { section: 'releases', label: 'Bundles', icon: Layers3 },
      { section: 'channels', label: 'Channels', icon: RadioTower },
      { section: 'devices', label: 'Devices', icon: Smartphone },
      { section: 'stats', label: 'Stats', icon: ChartNoAxesColumn },
    ]
  : [])

function initials(value?: string) {
  return (value || 'RN').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="sidebar-backdrop" :class="{ visible: sidebarOpen }" aria-hidden="true" @click="emit('closeSidebar')" />

  <aside id="sidebar" class="capgo-sidebar" :class="{ open: sidebarOpen }" aria-label="Console navigation">
    <div class="sidebar-header safe-zone">
      <button class="sidebar-close" type="button" aria-controls="sidebar" :aria-expanded="sidebarOpen" @click.stop="emit('closeSidebar')">
        <span class="sr-only">Close sidebar</span>
        <X :size="18" />
      </button>

      <a class="sidebar-logo" href="/app/home" aria-label="CodePushGo console" @click.prevent="emit('navigate', 'home')">
        <img src="/favicon.svg" alt="CodePushGo logo">
        <span>CodePushGo</span>
      </a>
    </div>

    <div class="app-switcher" :class="{ disabled: !hasApps }">
      <button type="button" :disabled="!hasApps" @click="emit('toggleAppMenu')">
        <span class="app-icon">{{ initials(selectedApp?.name) }}</span>
        <span>
          <strong>{{ selectedApp?.name || 'No app yet' }}</strong>
          <small>{{ selectedApp?.app_id || 'React Native bundle ID' }}</small>
        </span>
        <ChevronDown :size="16" />
      </button>

      <div v-if="appMenuOpen" class="app-switcher-menu">
        <button v-for="app in apps" :key="app.app_id" type="button" @click="emit('navigate', 'overview', app.app_id)">
          <span class="app-icon">{{ initials(app.name) }}</span>
          <span>
            <strong>{{ app.name }}</strong>
            <small>{{ app.app_id }}</small>
          </span>
        </button>
      </div>
    </div>

    <nav class="sidebar-nav" aria-label="Pages">
      <h3>
        <span aria-hidden="true">...</span>
        <span>Pages</span>
      </h3>
      <a href="/app/home" :class="{ active: currentSection === 'home' }" @click.prevent="emit('navigate', 'home')">
        <Home :size="22" />
        <span>Dashboard</span>
      </a>
      <a
        v-for="item in appNavItems"
        :key="item.section"
        :href="`/app/p/${encodeURIComponent(selectedAppId)}`"
        :class="{ active: currentSection === item.section }"
        @click.prevent="emit('navigate', item.section)"
      >
        <component :is="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </a>
      <a href="/dashboard/apikeys" :class="{ active: currentSection === 'api-keys' }" @click.prevent="emit('navigate', 'api-keys')">
        <KeyRound :size="22" />
        <span>API Keys</span>
      </a>
      <a href="/dashboard/settings/plans" :class="{ active: currentSection === 'settings' }" @click.prevent="emit('navigate', 'settings')">
        <Settings :size="22" />
        <span>Settings</span>
      </a>
      <a href="https://codepushgo.com/docs/" target="_blank" rel="noopener">
        <BookOpen :size="22" />
        <span>Documentation</span>
      </a>
    </nav>

    <div class="sidebar-account">
      <p>Signed in</p>
      <strong>{{ displayName }}</strong>
      <small>{{ email }}</small>
      <button type="button" @click="emit('signOut')">
        <LogOut :size="16" />
        Sign out
      </button>
    </div>
  </aside>
</template>
